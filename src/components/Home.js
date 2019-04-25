import React from 'react'
import MyWeb3 from 'web3'
import Header from './Header'

class Home extends React.Component {
    constructor() {
        super()
        this.state = {
            seedPhrase: '',
            guardarClicked: false,
            response: '',
            seedSetupMessage: '',
            automatizeMessage: '',
            automations: [],

            nombre: '',
            fecha: '',
            horaPrimerPago: '',
            email: '',
            vecesRepetir: 0,
            receiver: '',
            intervalo: 0,
            cantidad: 0,
        }
        this.start()
    }

    async start() {
        let response = await fetch('/is-seed-setup')
        response = await response.json()
        if(response.isOk) {
            this.setState({
                seedSetupMessage: 'Ya hay una seed guardada en el programa, puedes cambiarla si quieres debajo',
                guardarClicked: true,
            })
        } else {
            this.setState({seedSetupMessage: 'No hay ninguna seed guardada en el programa, añade una nueva'})
        }
        response = await fetch('/automations')
        response = await response.json()
        this.setState({automations: response})
        // Quitado de momento por añadir bastante complejidad
        // response = await fetch('/get-accounts-seed')
        // response = await response.json()
        // console.log('Accounts seed', response)
    }

    async guardarSeed() {
        if(this.state.seedPhrase.length == 0) return this.setState({response: 'Tienes que añadir la seed phrase para guardar'})
        if(this.state.seedPhrase.trim().split(' ').length != 12) return this.setState({response: 'La seed phrase que has introducido es inválida, debe tener 12 palabras separadas por un espacio cada una'})
        let response = await fetch('/seed-phrase', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({seedPhrase: this.state.seedPhrase.trim()}),
        })
        response = await response.json()
        if(response.isOk) {
            this.setState({response: 'Guardada seed phrase con éxito', guardarClicked: true})
        } else {
            this.setState({response: 'No se pudo guardar la seed phrase, inténtalo de nuevo'})
        }
    }

    async automatize() {
        if(this.state.fecha.length == 0) return alert('Tienes que poner la fecha del primer pago')
        if(this.state.horaPrimerPago == 0) return alert('Tienes que poner la hora del primer pago')
        if(this.state.receiver.length == 0) return alert('Tienes que poner el recipient del pago')
        if(this.state.vecesRepetir == 0) return alert('Tienes que poner las veces a repetir el pago (0 es infinitas veces)')
        if(this.state.cantidad == 0) return alert('Tienes que poner la cantidad de tokens a enviar')
        let response = await fetch('/automatize', {
            method: 'post',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                nombre: this.state.nombre,
                fecha: this.state.fecha,
                horaPrimerPago: this.state.horaPrimerPago,
                email: this.state.email,
                vecesRepetir: this.state.vecesRepetir,
                receiver: this.state.receiver,
                intervalo: this.state.intervalo,
                cantidad: this.state.cantidad,
            }),
        })
        response = await response.json()
        if(response.isOk) return this.setState({automatizeMessage: 'Se ha iniciado la automatización con éxito'})
        else return this.setState({automatizeMessage: 'No se ha podido iniciar la automatización, inténtalo de nuevo'})
    }

    render() {
        return (
            <div>
                <Header />
                <div className="home-container">
                    <div className="clave-privada">
                        <h2>1. Acceso a la cuenta</h2>
                        <p>Añade tu seed phrase para poder realizar pagos sin tener que confirmar transacciones</p>
                        <b>{this.state.seedSetupMessage}</b>
                        <input onChange={e => {
                            this.setState({seedPhrase: e.target.value})
                        }} type="text" placeholder="Seed phrase..."/>
                        <button onClick={async () => {
                            this.guardarSeed()
                        }}>Guardar</button>
                        <b>{this.state.response}</b>
                    </div>

                    <div className="automatizacion">
                        <h2 className="title">2. Automatización de pagos</h2>
                        <p className="subtitle">Programa los pagos automáticos, el asterisco indica campo obligatorio</p>
                        <b>{this.state.automatizeMessage}</b>
                        <div className="two-block">
                            <p>Nombre:</p>
                            <input onChange={e => {
                                this.setState({nombre: e.target.value})
                            }} type="text" placeholder="Nombre del recipiente..."/>
                        </div>
                        <div className="two-block">
                            <p>*Fecha:</p>
                            <input onChange={e => {
                                this.setState({fecha: e.target.value})
                            }} onBlur={e => {
                                this.setState({fecha: e.target.value})
                            }} type="date" placeholder="Fecha..."/>
                        </div>
                        <div className="two-block">
                            <p>*Hora del primer pago:</p>
                            <input onChange={e => {
                                this.setState({horaPrimerPago: e.target.value})
                            }} onBlur={e => {
                                this.setState({horaPrimerPago: e.target.value})
                            }} type="time" placeholder="Hora de pago..." />
                        </div>
                        <div className="two-block">
                            <p>Email:</p>
                            <input onChange={e => {
                                this.setState({email: e.target.value})
                            }} type="email" placeholder="Correo electrónico..."/>
                        </div>
                        <div className="two-block">
                            <p>*Recipiente:</p>
                            <input onChange={e => {
                                this.setState({receiver: e.target.value})
                            }} type="text" placeholder="Cuenta de Ethereum 0x328dj238..."/>
                        </div>
                        {/*<div className="two-block">
                            <p>Emisor:</p>
                            <select defaultValue="market-order" onChange={selected => {
                                this.setState({emisor: selected.target.value})
                            }}>
                                <option value="market-order">Market Order</option>
                                <option value="limit-order">Limit Order</option>
                            </select>
                        </div>*/}
                        <div className="two-block">
                            <p>*Veces a repetir el pago:</p>
                            <input onChange={e => {
                                this.setState({vecesRepetir: e.target.value})
                            }} type="number" placeholder="Zero es infinitas veces..." />
                        </div>
                        <div className="two-block">
                            <p>Intervalo de pago:</p>
                            <input onChange={e => {
                                this.setState({intervalo: e.target.value})
                            }} type="number" placeholder="Repetir pago cada X horas tras el primero..." />
                        </div>
                        <div className="two-block">
                            <p>*Tokens por pago:</p>
                            <input onChange={e => {
                                this.setState({cantidad: e.target.value})
                            }} type="number" placeholder={`Tokens a enviar cada ${this.state.intervalo == 1 ? '1 hora' : this.state.intervalo + ' horas'}...`} />
                        </div>
                        <button disabled={!this.state.guardarClicked} title="Tienes que guardar tu seed phrase antes de activar la automatización" className="payment-button" onClick={() => {
                            this.automatize()
                            window.scrollTo(0, 0)
                        }}>Comenzar a realizar pagos</button>
                    </div>
                </div>
                <Dashboard automations={this.state.automations} />
                <div className="end-spacer"></div>
            </div>
        )
    }
}

class Dashboard extends React.Component {
    constructor() {
        super()
        this.state = {
            mensajePagosDetenidos: ''
        }
    }

    async detenerPagos() {
        let result = await fetch('/stop-automatize')
        result = await result.json()
        if(result.isOk) this.setState({mensajePagosDetenidos: 'Se han detenido los pagos con éxito'})
        else this.setState({mensajePagosDetenidos: 'No se ha podido detener los pagos debido a un error, inténtalo de nuevo'})
    }

    render() {
        let automationsHTML = this.props.automations.map(element => (
            <div key={element.id} className="automation-container">
                <div>Nombre {element.nombre}</div>
                <div>Email {element.email}</div>
                <div>Fecha {element.fecha}</div>
                <div>Hora primer pago {element.horaPrimerPago}</div>
                <div>Receptor {element.receiver}</div>
                <div>Cantidad {element.cantidad}</div>
                <div>Intervalo {element.intervalo}</div>
                <div>Veces a pagar {element.vecesRepetir}</div>
                <div>Veces pagado {element.timesPaid}</div>
            </div>
        ))

        return(
            <div className="dashboard">
                <div>
                    {automationsHTML}
                </div>
                <b>{this.props.automations.length <= 0 ? 'No hay ninguna automatización en progreso' : ''}</b>
                <p><b>{this.state.mensajePagosDetenidos}</b></p>
                <button onClick={() => this.detenerPagos()}>Detener pagos</button>
            </div>
        )
    }
}

export default Home
