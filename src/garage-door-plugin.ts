import {
    AccessoryConfig,
    API,
    CharacteristicEventTypes,
    HAP,
    Logging,
    Service
} from "homebridge";

let hap: HAP;

module.exports = (api) => {
    hap = api.hap;
    api.registerAccessory('GarageDoor', GarageDoorAccessory);
};

class GarageDoorAccessory {

    private readonly garageService: Service;
    private readonly informationService: Service;

    private readonly log: Logging;
    private readonly name: string;
    private readonly url: string;

    private timeout: any;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.name = config.name;
        this.url = config.url;

        this.garageService = new hap.Service.GarageDoorOpener(this.name);
        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, "Custom")
            .setCharacteristic(hap.Characteristic.Model, "Custom");

        // create handlers for required characteristics
        this.garageService.getCharacteristic(hap.Characteristic.CurrentDoorState)
            .on(CharacteristicEventTypes.GET, this.handleDoorState.bind(this));

        this.garageService.getCharacteristic(hap.Characteristic.TargetDoorState)
            .on(CharacteristicEventTypes.GET, this.handleDoorState.bind(this))
            .on(CharacteristicEventTypes.SET, this.handleTargetDoorStateSet.bind(this));

    }

    /**
     * Handle requests to get the current value of the "Target Door State" characteristic
     */
    handleDoorState(callback) {

        this.log.debug('Triggered GET TargetDoorState:' + hap.Characteristic.CurrentDoorState.OPEN);
        const axios = require('axios').default;
        axios.get(`${this.url}/status`).then(r => {
            callback(null, r.data == 'open' ? hap.Characteristic.CurrentDoorState.OPEN : hap.Characteristic.CurrentDoorState.CLOSED);
        });

        this.pollDoorState();
    }

    pollDoorState() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        this.timeout = setTimeout(() => {
            this.handleDoorState((state) => {
                this.garageService.getCharacteristic(hap.Characteristic.TargetDoorState).setValue(state, undefined, 'pollState');
                this.garageService.setCharacteristic(hap.Characteristic.CurrentDoorState, state);
            })
        }, 3000)
    }

    /**
     * Handle requests to set the "Target Door State" characteristic
     */
    handleTargetDoorStateSet(value, callback, context) {
        if (context === 'pollState') {
            // The state has been updated by the pollState command - don't run the open/close command
            callback(null);
            return;
        }
        this.log.debug('Triggered SET TargetDoorState:' + value);

        const axios = require('axios').default;
        axios.post(`${this.url}/toggle`).then(r => {
            if (value == 'open') {
                this.garageService.setCharacteristic(hap.Characteristic.CurrentDoorState, hap.Characteristic.CurrentDoorState.OPENING);
                setTimeout(() =>
                    this.garageService.setCharacteristic(hap.Characteristic.CurrentDoorState, hap.Characteristic.CurrentDoorState.OPEN)
                 ,
                  3000
                );
              } else {
                this.garageService.setCharacteristic(hap.Characteristic.CurrentDoorState, hap.Characteristic.CurrentDoorState.CLOSING);
                setTimeout(() =>
                    this.garageService.setCharacteristic(hap.Characteristic.CurrentDoorState, hap.Characteristic.CurrentDoorState.CLOSED)
                  ,
                  3000
                );
              }
        });
    }


    getServices(): Service[] {
        return [
            this.informationService,
            this.garageService,
        ];
    }
}