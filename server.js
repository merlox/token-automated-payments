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
	}
	let automatizaciones = storage.get('automatizaciones') ? storage.get('automatizaciones') : []
	automatizaciones.push(automatizacion)
	storage.set('automatizaciones', automatizaciones)
	storage.set('lastId', lastId)
	automatize()
	res.send(JSON.stringify({isOk: true}))
})
app.get('/automations', (req, res) => {
	res.send(JSON.stringify(storage.get('automatizaciones')))
})
app.get('/stop-automatize', (req, res) => {
	storage.set('interval', undefined)
	storage.set('receiver', undefined)
	storage.set('tokens', undefined)
	storage.set('isActive', undefined)
	clearInterval(interval)
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
	interval = setInterval(() => {
		let automationChanged = false
		for(let i = 0; i < automatizaciones.length; i++) {
			let auto = automatizaciones[i]
			let fecha = new Date().toLocaleString('es-ES', {hour12: false, day: '2-digit', month: '2-digit', year: '2-digit'}).split('/')
			let tiempo = new Date().toLocaleString('es-ES', {hour12: false, hour: '2-digit', minute: '2-digit'}).split(':')
			let dia = parseInt(fecha[0])
			let mes = parseInt(fecha[1])
			let año = parseInt(fecha[2])
			let hora = parseInt(tiempo[0])
			let minuto = parseInt(tiempo[1])
			let diaObjetivo = parseInt(auto.fecha.split('-')[2])
			let mesObjetivo = parseInt(auto.fecha.split('-')[1])
			let añoObjetivo = parseInt(auto.fecha.split('-')[0])
			let horaObjetivo = parseInt(auto.horaPrimerPago.split(':')[0])
			let minutoObjetivo = parseInt(auto.horaPrimerPago.split(':')[1])
			if(auto.timesPaid == 0) {
				// If the time has come, send the first payment
				if(año >= añoObjetivo && mes >= mesObjetivo && dia >= diaObjetivo && hora >= horaObjetivo && minuto >= minutoObjetivo)
					console.log('Sending first payment...')
					automatizaciones[i].timesPaid++
					transfer(auto.receiver, auto.cantidad, automatizaciones[i])
					automationChanged = true
				}
			} else if(auto.timesPaid < auto.vecesRepetir) {
				// Si hay otra repetición, enviar el pago
				console.log('Sending repeated payment...')
				automatizaciones[i].timesPaid++
				transfer(auto.receiver, auto.cantidad, automatizaciones[i])
				automationChanged = true
			}
		}
		if(automationChanged) {
			storage.set('automatizaciones', automatizaciones)
		}
	}, 60e3) // Every 60 seconds
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
        gasPrice: 5e9, // 5 GWEI not wei
        to: contractAddress,
        data: encodedTransfer,
		chainId: 1,
        chainId: 3, // Ropsten TODO uncomment this on production
    }
	let pastResults = storage.get('history') ? storage.get('history') : []

    web3.eth.accounts.signTransaction(tx, privateKey).then(signed => {
        console.log('Generating transaction...')
        web3.eth.sendSignedTransaction(signed.rawTransaction)
            .on('receipt', result => {
                console.log('Transfer successful!')
				automation.isOk = true
				automation.error = false
				pastResults.push(automation)
				storage.set('history', pastResults)
            })
            .catch(error => {
				console.log('Error', error)
				automation.isOk = false
				automation.error = error
				pastResults.push(automation)
				storage.set('history', pastResults)
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
