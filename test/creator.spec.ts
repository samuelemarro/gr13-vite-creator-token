import { describe } from "mocha";
import chai from "chai";
const vite = require('@vite/vuilder');
import chaiAsPromised from "chai-as-promised";
import config from "./vite.config.json";

chai.use(chaiAsPromised);
const expect = chai.expect;

let provider: any;
let deployer: any;
let alice: any;
let bob: any;
let charlie: any;
let contract: any;

const firstTokenId = '5042';
const secondTokenId = '79217';

describe('test CreatorToken', function () {
    before(async function () {
        provider = vite.localProvider();
        // init users
        deployer = vite.newAccount(config.networks.local.mnemonic, 0);
        alice = vite.newAccount(config.networks.local.mnemonic, 1);
        bob = vite.newAccount(config.networks.local.mnemonic, 2);
        charlie = vite.newAccount(config.networks.local.mnemonic, 3);
        await deployer.sendToken(alice.address, '0');
        await alice.receiveAll();
        await deployer.sendToken(bob.address, '0');
        await bob.receiveAll();
        await deployer.sendToken(charlie.address, '0');
        await charlie.receiveAll();
        // compile
        const compiledContracts = await vite.compile('CreatorToken.solpp');
        expect(compiledContracts).to.have.property('CreatorToken');
        contract = compiledContracts.CreatorToken;
        // deploy
        contract.setDeployer(deployer).setProvider(provider);
        await contract.deploy({params: [], responseLatency: 1});
        expect(contract.address).to.be.a('string');
    });

    describe('createToken', function() {
        it('creates a token', async function() {
            await contract.call('createToken', [154], {caller: alice});
        });

        /*it('fails to create a token with an odd coefficient', async function() {
            await expect(
                contract.call('createToken', [153], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });*/
    })
});