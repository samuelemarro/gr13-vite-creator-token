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
            expect(await contract.query('exists', [alice.address], {caller: alice})).to.be.equal(true);
            expect(await contract.query('tokenCoefficient', [alice.address], {caller: alice})).to.be.equal(154);
            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.equal(10000);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.equal(10000);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.equal(0);
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.equal(0);

            // TODO: Check events
        });

        it('fails to create a token with an odd coefficient', async function() {
            await expect(
                contract.call('createToken', [153], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to create a token with coefficient 0', async function() {
            await expect(
                contract.call('createToken', [0], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to create a token twice', async function() {
            await contract.call('createToken', [154], {caller: alice});
            await expect(
                contract.call('createToken', [154], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    })

    describe('mint', function() {
        it('mints a token', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, tokenId: 'tti_5649544520544f4b454e6e40', amount: '56133'});
            expect(await contract.balance()).to.be.equal(56133);
            expect(await alice.balance()).to.be.equal(1000000 - 56133);

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.equal(10000 + 27);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.equal(10000 + 27);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.equal(27);
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.equal(154 * 27);

            // Mint 10 tokens
            // \int_27^37 154x dx = 49280
            await contract.call('mint', [alice.address, 10], {caller: alice, tokenId: 'tti_5649544520544f4b454e6e40', amount: '49280'});
            expect(await contract.balance()).to.be.equal(56133 + 49280);
            expect(await alice.balance()).to.be.equal(1000000 - (56133 + 49280));

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.equal(10000 + 27 + 10);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.equal(10000 + 27 + 10);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.equal(27 + 10);
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.equal(154 * (27 + 10));
        });

        it('fails to mint a non-existent token', async function() {
            await expect(
                contract.call('mint', [alice.address, 0], {caller: alice, tokenId: 'tti_5649544520544f4b454e6e40', amount: '56133'})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to mint 0 tokens', async function() {
            await contract.call('createToken', [154], {caller: alice});
            await expect(
                contract.call('mint', [alice.address, 0], {caller: alice, tokenId: 'tti_5649544520544f4b454e6e40', amount: '56133'})
            ).to.eventually.be.rejectedWith('revert');
        });
    })
});