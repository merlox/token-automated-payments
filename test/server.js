const assert = require('assert')
const request = require('request-promise')

describe('Basic testing of the server', () => {
    it('should add the seed properly', async () => {
        let formData = {
            seedPhrase: 'earn road aerobic mushroom merry exclude orchard extra absent figure wool direct'
        }
        let response = await request.post({url: 'http://localhost:80/seed-phrase', form: formData})
        response = JSON.parse(response)
        assert.ok(response.isOk, 'The response should be okay')
    })

    it('should start an automation successfully', async () => {
        let formData = {
            nombre: 'Merunas',
            fecha: '2019-05-05', // year month day
            horaPrimerPago: '05:05',
            email: 'example@gmail.com',
            vecesRepetir: 0,
            receiver: '0x2f9Ca2457E74Fc3f359F82B1C34d3118e596ba42',
            intervalo: 4,
            cantidad: 10,
        }
        let response = await request.post({url: 'http://localhost:80/automatize', form: formData})
        response = JSON.parse(response)
        assert.ok(response.isOk, 'The response should be okay')
    })
})
