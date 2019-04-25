// First a UI where the user can input an ethereum address, input how many tokens to send and input the time period
// There will be a nodejs application that has to be running constantly, the nodejs app will store in localstorage the data introduced
// node.js pkg para distribuir la dApp entera en un solo ejecutable

// The user first will introduce the private key which will be stored on the localstorage of the nodejs dapp
// After that is setup and the user has selected the data to sent, the nodejs dapp will

import React from 'react'
import ReactDOM from 'react-dom'
import MyWeb3 from 'web3'
import { BrowserRouter, Route, withRouter } from 'react-router-dom'
import Home from './components/Home'
import './index.styl'

Array.prototype.asyncForEach = function (callback) {
    return new Promise(resolve => {
        for(let i = 0; i < this.length; i++) {
            callback(this[i], i, this)
        }
        resolve()
    })
}

class Main extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
        }
    }

    redirectTo(location) {
    	this.props.history.push({
    		pathname: location
    	})
    }

    render() {
        return (
            <div>
                <Route path="/" exact render={() => (
                    <Home />
                )} />
            </div>
        )
    }
}

// To be able to access the history in order to redirect users programatically when opening a product
Main = withRouter(Main)

ReactDOM.render(
    <BrowserRouter>
        <Main />
    </BrowserRouter>,
document.querySelector('#root'))
