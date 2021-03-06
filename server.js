'use strict'

const Web3 = require('web3')
const bip39 = require("bip39");
const hdkey = require('ethereumjs-wallet/hdkey');
const express = require('express')
const app = express()
const fs = require('fs')
const bodyParser = require('body-parser')
const path = require('path')
const Store = require('data-store')
const storage = new Store({path: 'config.json'})
const yargs = require('yargs')
const argv = yargs.option('port', {
    alias: 'p',
    description: 'Set the port to run this server on',
    type: 'number',
}).help().alias('help', 'h').argv
if(!argv.port) {
    console.log('Error, you need to pass the port you want to run this application on with npm start -- -p 8001')
    process.exit(0)
}
const port = argv.port

let infura
let contractAddress
let contractInstance
let web3
let privateKey
let myAddress
let interval

if(process.env.NODE_ENV == 'development') {
	infura = 'wss://ropsten.infura.io/ws/v3/f7b2c280f3f440728c2b5458b41c663d' // Ropsten
	contractAddress = '0x3ab136900ce4d05282782c58ebaf7fc811adda40' // Ropsten
	console.log('Environment development')
} else {
	infura = 'wss://mainnet.infura.io/ws/v3/f7b2c280f3f440728c2b5458b41c663d'
	contractAddress = '0x82e5497347eC3d9a98632b7d5A844b645F0bA8c6'
	console.log('Environment production')
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))
app.use('*', (req, res, next) => {
	// Logger
	let time = new Date()
	console.log(`${req.method} to ${req.originalUrl} at ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}`)
	next()
})
// Compression request to send the valid build files
app.get('build.js', (req, res) => {
	if (req.header('Accept-Encoding').includes('br')) {
		res.set('Content-Encoding', 'br')
		res.set('Content-Type', 'application/javascript; charset=UTF-8')
		res.sendFile(path.join(__dirname, 'dist', 'build.js.br'))
	} else if(req.header('Accept-Encoding').includes('gz')) {
		res.set('Content-Encoding', '.gz')
		res.set('Content-Type', 'application/javascript; charset=UTF-8')
		res.sendFile(path.join(__dirname, 'dist', 'build.js.gz'))
	}
})
app.use(express.static('dist'))
app.post('/seed-phrase', (req, res) => {
	let mnemonic = req.body.seedPhrase.trim()
    storage.set('seedPhrase', mnemonic)
    console.log('Saved seed phrase')
	generateAddressesFromSeed(mnemonic)
    res.send(JSON.stringify({isOk: true}))
})
app.post('/automatize', async (req, res) => {
	let lastId = storage.get('lastId') ? storage.get('lastId') : 1
	lastId++
	const automatizacion = {
		id: lastId,
		nombre: req.body.nombre,
		fecha: req.body.fecha,
		horaPrimerPago: req.body.horaPrimerPago,
		email: req.body.email,
		vecesRepetir: req.body.vecesRepetir,
		receiver: req.body.receiver,
		intervalo: req.body.intervalo,
		cantidad: req.body.cantidad,
		timesPaid: 0,
		lastPayment: 0,
	}
	let automatizaciones = storage.get('automatizaciones') ? storage.get('automatizaciones') : []
	automatizaciones.push(automatizacion)
	storage.set('automatizaciones', automatizaciones)
	storage.set('lastId', lastId)
	clearInterval(interval)
	await asyncTimeout(3e3)
	automatize(automatizaciones)
	res.send(JSON.stringify({isOk: true}))
})
app.get('/automations', (req, res) => {
	const automations = storage.get('automatizaciones') ? JSON.stringify(storage.get('automatizaciones')) : []
	res.send(automations)
})
app.post('/stop-automatize', async (req, res) => {
	let automatizaciones = storage.get('automatizaciones')
	// Delete the automatizacion with that id while keeping the rest
	let autoWithoutElement = automatizaciones.filter(element => element.id !== req.body.id)

	storage.set('automatizaciones', autoWithoutElement)
	clearInterval(interval)
	automatize(autoWithoutElement)
	res.send(JSON.stringify({isOk: true}))
})
app.get('/is-seed-setup', (req, res) => {
	if(storage.get('seedPhrase')) return res.send(JSON.stringify({isOk: true}))
	else return res.send(JSON.stringify({isOk: false}))
})
app.get('/current-state', (req, res) => {
	let state = {
		interval: storage.get('interval') ? storage.get('interval') : 0,
		receiver: storage.get('receiver') ? storage.get('receiver') : '',
		tokens: storage.get('tokens') ? storage.get('tokens') : 0,
		history: storage.get('history') ? storage.get('history') : [],
		isActive: storage.get('isActive') ? storage.get('isActive') : false,
		ultimoPago: storage.get('ultimoPago') ? storage.get('ultimoPago') : false
	}
	res.send(JSON.stringify(state))
})

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on localhost:${port}`)
	setup()
})

async function automatize(automatizaciones) {
	console.log('Starting automatization...')
	await payment(automatizaciones)
	interval = setInterval(async () => {
		console.log('----- Running new repeated automation -----')
		await payment(automatizaciones)
	}, 60e3) // Every 60 seconds
}

function payment(automatizaciones) {
	console.log('Running interval...')
	return new Promise(async resolve => {
		let automationChanged = false
		for(let i = 0; i < automatizaciones.length; i++) {
			let auto = automatizaciones[i]
			let diaObjetivo = parseInt(auto.fecha.split('-')[2])
			let mesObjetivo = parseInt(auto.fecha.split('-')[1])
			let añoObjetivo = parseInt(auto.fecha.split('-')[0])
			let horaObjetivo = parseInt(auto.horaPrimerPago.split(':')[0])
			let minutoObjetivo = parseInt(auto.horaPrimerPago.split(':')[1])

			let dateAhora = Date.now()
			let dateObjetivo = new Date(añoObjetivo, mesObjetivo - 1, diaObjetivo, horaObjetivo, minutoObjetivo).getTime()

			if(auto.timesPaid == 0 && dateAhora >= dateObjetivo) {
				// If the time has come, send the first payment
				console.log('Sending first payment...')
				automatizaciones[i].timesPaid++
				automatizaciones[i].lastPayment = Date.now()
				await asyncTimeout(1e3)
				await transfer(auto.receiver, auto.cantidad, automatizaciones[i])
				automationChanged = true
			} else if((auto.vecesRepetir == 0 || auto.timesPaid < auto.vecesRepetir) && (new Date(dateAhora).getTime() - new Date(auto.lastPayment).getTime()) >= auto.intervalo * 1e3 * 60 * 60) {
				// Si hay otra repetición, enviar el pago
				console.log('Sending repeated payment...')
				automatizaciones[i].timesPaid++
				automatizaciones[i].lastPayment = Date.now()
				await asyncTimeout(1e3)
				await transfer(auto.receiver, auto.cantidad, automatizaciones[i])
				automationChanged = true
			}
		}

		if(automationChanged) {
			console.log('Automations sent...')
			storage.set('automatizaciones', automatizaciones)
		} else {
			console.log('No automations sent...')
		}
		resolve()
	})
}

function checkActiveInterval() {
	console.log('Checking active intervals...')
	let automatizaciones = storage.get('automatizaciones')
	if(automatizaciones) {
		automatize(automatizaciones)
	} else {
		console.log('None detected')
	}
}

// To send a transaction to run the generateRandom function
function transfer(receiver, cantidad, automation) {
	return new Promise(async resolve => {
	    const encodedTransfer = contractInstance.methods.transfer(receiver, cantidad * 1e6).encodeABI()
		let chainId = process.env.NODE_ENV == 'development' ? 3 : 1
		let nonce = await web3.eth.getTransactionCount(myAddress, 'pending')
		console.log('Sending nonce', nonce)
	    const tx = {
			nonce,
	        from: myAddress,
	        gas: 6e6,
	        gasPrice: 10e9, // 5 GWEI not wei
	        to: contractAddress,
	        data: encodedTransfer,
			chainId
	    }
		let history = storage.get('history') ? storage.get('history') : []
	    web3.eth.accounts.signTransaction(tx, privateKey).then(signed => {
			resolve()
	        console.log('Generating transaction...')
	        web3.eth.sendSignedTransaction(signed.rawTransaction)
	            .on('receipt', result => {
	                console.log('Transfer successful!', result.transactionHash)
					automation.isOk = true
					automation.error = false
					history.push(automation)
					storage.set('history', history)
	            })
	            .catch(error => {
					console.log('Error', error)
					automation.isOk = false
					automation.error = error
					history.push(automation)
					storage.set('history', history)
				})
	    })
	})
}

// Setup web3 and start listening to events
async function setup() {
	if(storage.get('seedPhrase')) {
	    const mnemonic = storage.get('seedPhrase')
	    await generateAddressesFromSeed(mnemonic)
	    web3 = new Web3(new Web3.providers.WebsocketProvider(infura))
	    const ABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'contracts', 'Token.json')))
	    contractInstance = new web3.eth.Contract(ABI.abi, contractAddress)
		console.log('Contract instance setup')
		checkActiveInterval()
	} else {
		console.log('No seed phrase found')
	}
}

// To generate the private key and address needed to sign transactions
function generateAddressesFromSeed(seed) {
	return new Promise(async resolve => {
	    let hdwallet = hdkey.fromMasterSeed(await bip39.mnemonicToSeed(seed));
	    let wallet_hdpath = "m/44'/60'/0'/0/0";
	    let wallet = hdwallet.derivePath(wallet_hdpath).getWallet();
	    let address = '0x' + wallet.getAddress().toString("hex");
	    let myPrivateKey = wallet.getPrivateKey().toString("hex");
	    myAddress = address
	    privateKey = '0x' + myPrivateKey
		resolve()
	})
}

function asyncTimeout(time) {
	return new Promise(resolve => {
		setTimeout(() => {resolve()}, time)
	})
}
