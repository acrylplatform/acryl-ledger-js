/// <reference path="../interface.d.ts"/>


import '@babel/polyfill';
import { Acryl, IUserData } from './Acryl';
import { default as TransportU2F } from '@ledgerhq/hw-transport-u2f';

declare const Buffer: any;

const ADDRES_PREFIX = '44\'/5741564\'/0\'/0\'/';

export class AcrylLedger {

    public ready: boolean;
    private _acrylLibPromise: Promise<Acryl> | null;
    private _initTransportPromise: Promise<any> | null;
    private _debug: boolean;
    private _openTimeout: number | undefined;
    private _listenTimeout: number | undefined;
    private _exchangeTimeout: number | undefined;
    private _networkCode: number;
    private _error: any;
    private _transport: any;

    constructor(options: IAcrylLedger) {
        this.ready = false;
        this._networkCode = options.networkCode == null ? 65 : options.networkCode;
        this._acrylLibPromise = null;
        this._initTransportPromise = null;
        this._debug = options.debug == null ? false : options.debug;
        this._openTimeout = options.openTimeout;
        this._listenTimeout = options.listenTimeout;
        this._exchangeTimeout = options.exchangeTimeout;
        this._error = null;
        this._transport = options.transport || TransportU2F;
        this.tryConnect();
    }

    async tryConnect(): Promise<void> {
        const disconnectPromise = this.disconnect();
        this._initU2FTransport();
        this._setSettings();
        this._initAcrylLib();
        await disconnectPromise;
        await Promise.all([this._initTransportPromise, this._acrylLibPromise]);
    }

    async disconnect(): Promise<void> {
        const transportpromise = this._initTransportPromise;
        this._initTransportPromise = null;
        this._acrylLibPromise = null;
        if (transportpromise) {
            try {
                const transport = await transportpromise;
                transport.close();
            } catch (e) {
            }
        }
    }

    async getTransport(): Promise<any> {
        try {
            return await this._acrylLibPromise;
        } catch (e) {
            await this.tryConnect();
            return await this._acrylLibPromise;
        }
    }

    async getUserDataById(id: number): Promise<IUser> {
        try {
            const acryl = await this.getTransport();
            const path = this.getPathById(id);
            const userData = await acryl.getWalletPublicKey(path, false);
            return {
                ...userData, id, path
            };
        } catch (e) {
            this.tryConnect();
            this._error = e;
            throw e;
        }
    }

    async getVersion(): Promise<Array<number>> {
        try {
            const acryl = await this.getTransport();
            return await acryl.getVersion();

        } catch (e) {
            this.tryConnect();
            this._error = e;
            throw e;
        }
    }

    async getPaginationUsersData(from: number, limit: number): Promise<Array<IUser>> {
        const usersData = [];

        try {
            for (let id = from; id <= from + limit; id++) {
                const userData = await this.getUserDataById(id);
                usersData.push(userData);
            }
        } catch (e) {
            this.tryConnect();
            this._error = e;
            throw e;
        }

        return usersData;
    }

    async signTransaction(userId: number, asset: { precision: number }, txData: Uint8Array, version = 2) {
        const path = this.getPathById(userId);
        const msgData = new Buffer(txData);
        try {
            const acryl = await this.getTransport();
            return await acryl.signTransaction(path, asset.precision, msgData, version);
        } catch (e) {
            this.tryConnect();
            this._error = e;
            throw e;
        }
    }

    async signOrder(userId: number, asset: { precision: number }, txData: Uint8Array) {
        const path = this.getPathById(userId);
        const msgData = new Buffer(txData);
        try {
            const acryl = await this.getTransport();
            return await acryl.signOrder(path, asset.precision, msgData);
        } catch (e) {
            this.tryConnect();
            this._error = e;
            throw e;
        }
    }

    async signSomeData(userId: number, dataBuffer: Uint8Array) {
        const path = this.getPathById(userId);
        const msgData = new Buffer(dataBuffer);
        try {
            const acryl = await this.getTransport();
            return await acryl.signSomeData(path, msgData);
        } catch (e) {
            this.tryConnect();
            this._error = e;
            throw e;
        }
    }

    async signRequest(userId: number, dataBuffer: Uint8Array) {
        const path = this.getPathById(userId);
        const msgData = new Buffer(dataBuffer);
        try {
            const acryl = await this.getTransport();
            return await acryl.signRequest(path, msgData);
        } catch (e) {
            this.tryConnect();
            this._error = e;
            throw e;
        }
    }

    async signMessage(userId: number, message: string) {
        const path = this.getPathById(userId);
        const msgData = new Buffer(message, 'ascii');
        try {
            const acryl = await this.getTransport();
            return await acryl.signMessage(path, msgData);
        } catch (e) {
            this.tryConnect();
            this._error = e;
            throw e;
        }
    }

    getLastError() {
        return this._error;
    }

    async probeDevice() {
        if (!this.ready) {
            await this.tryConnect();
        }

        this._error = null;

        try {
            await this.getUserDataById(1);
        } catch (e) {
            this._error = e;
            return false;
        }

        return true;
    }

    getPathById(id: number) {
        return `${ADDRES_PREFIX}${id}'`;
    }

    _setSettings() {
        (this._initTransportPromise as Promise<any>).then((transport) => {
            transport.setDebugMode(this._debug);
            transport.setExchangeTimeout(this._exchangeTimeout);
        });
    }

    _initU2FTransport() {
        this.ready = false;
        this._initTransportPromise = this._transport.create(this._openTimeout, this._listenTimeout);
        return this._initTransportPromise;
    }

    _initAcrylLib() {
        this._acrylLibPromise = (this._initTransportPromise as Promise<any>).then(
            (transport: any) => {
                this.ready = true;
                return new Acryl(transport, this._networkCode);
            });
        return this._acrylLibPromise;
    }

}

export default AcrylLedger;

interface IAcrylLedger {
    debug?: boolean;
    openTimeout?: number;
    listenTimeout?: number;
    exchangeTimeout?: number;
    networkCode?: number,
    transport?: any;
}

interface IUser extends IUserData {
    id: number;
    path: string;
}
