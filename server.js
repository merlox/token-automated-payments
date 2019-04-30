const Web3 = require('web3')
const bip39 = require("bip39");
const hdkey = require('ethereumjs-wallet/hdkey');
const express = require('express')
const app = express()
const fs = require('fs')
const bodyParser = require('body-parser')
const path = require('path')
const Store = require('data-store')
const port = 8000
// const infura = 'wss://mainnet.infura.io/ws/v3/f7b2c280f3f440728c2b5458b41c663d'
const infura = 'wss://ropsten.infura.io/ws/v3/f7b2c280f3f440728c2b5458b41c663d'
const storage = new Store({path: 'config.json'})
// let contractAddress = '0x82e5497347eC3d9a98632b7d5A844b645F0bA8c6' // Mainnet
let contractAddress = '0x3ab136900ce4d05282782c58ebaf7fc811adda40' // Ropsten
let contractInstance
let web3
let privateKey
let myAddress
let interval

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))
app.use((req, res, next) => {
	console.log(`Requesting ${req.url}`)
    next()
})
app.post('/seed-phrase', (req, res) => {
    storage.set('seedPhrase', req.body.seedPhrase.trim())
    console.log('Saved seed phrase')
    res.send(JSON.stringify({isOk: true}))
})
app.post('/automatize', (req, res) => {
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
	automatize(automatizaciones)
	res.send(JSON.stringify({isOk: true}))
})
app.get('/automations', (req, res) => {
	const automations = storage.get('automatizaciones') ? JSON.stringify(storage.get('automatizaciones')) : []
	res.send(automations)
})
app.post('/stop-automatize', (req, res) => {
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
app.get('/bundle.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'bundle.js'))
})
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on localhost:${port}`)
	setup()
	checkActiveInterval()
})

function automatize(automatizaciones) {
	console.log('Starting automatization...')
	payment(automatizaciones)
	interval = setInterval(() => payment(automatizaciones), 60e3) // Every 60 seconds
}

function payment(automatizaciones) {
	console.log('Running interval...')
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

		console.log('Date ahora', dateAhora)
		console.log('Date objetivo', dateObjetivo)

		if(auto.timesPaid == 0 && dateAhora >= dateObjetivo) {
			// If the time has come, send the first payment
			console.log('Sending first payment...')
			automatizaciones[i].timesPaid++
			automatizaciones[i].lastPayment = Date.now()
			transfer(auto.receiver, auto.cantidad, automatizaciones[i])
			automationChanged = true
		} else if(auto.timesPaid < auto.vecesRepetir && (dateAhora - auto.lastPayment) * 60 >= auto.intervalo) {
			// Si hay otra repetición, enviar el pago
			console.log('Sending repeated payment...')
			automatizaciones[i].timesPaid++
			transfer(auto.receiver, auto.cantidad, automatizaciones[i])
			automationChanged = true
		}
	}

	if(automationChanged) {
		console.log('Automations sent...')
		storage.set('automatizaciones', automatizaciones)
	} else {
		console.log('No automations sent...')
	}
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
    const encodedTransfer = contractInstance.methods.transfer(receiver, cantidad * 1e6).encodeABI()
    const tx = {
        from: myAddress,
        gas: 6e6,
        gasPrice: 10e9, // 5 GWEI not wei
        to: contractAddress,
        data: encodedTransfer,
		chainId: 1,
        chainId: 3, // Ropsten TODO uncomment this on production
    }
	let history = storage.get('history') ? storage.get('history') : []
    web3.eth.accounts.signTransaction(tx, privateKey).then(signed => {
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
}

// Setup web3 and start listening to events
function setup() {
	if(storage.get('seedPhrase')) {
	    const mnemonic = storage.get('seedPhrase')
	    generateAddressesFromSeed(mnemonic)
	    web3 = new Web3(new Web3.providers.WebsocketProvider(infura))
	    const ABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'contracts', 'Token.json')))
	    contractInstance = new web3.eth.Contract(ABI.abi, contractAddress)
		console.log('Contract instance setup')
	} else {
		console.log('No seed phrase found')
	}
}

// To generate the private key and address needed to sign transactions
async function generateAddressesFromSeed(seed) {
    let hdwallet = hdkey.fromMasterSeed(await bip39.mnemonicToSeed(seed));
    let wallet_hdpath = "m/44'/60'/0'/0/0";
    let wallet = hdwallet.derivePath(wallet_hdpath).getWallet();
    let address = '0x' + wallet.getAddress().toString("hex");
    let myPrivateKey = wallet.getPrivateKey().toString("hex");
    myAddress = address
    privateKey = '0x' + myPrivateKey
}
