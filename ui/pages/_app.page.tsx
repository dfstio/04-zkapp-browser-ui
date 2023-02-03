import '../styles/globals.css';
import { useEffect, useState } from 'react';
import './reactCOIServiceWorker';

import ZkappWorkerClient from './zkappWorkerClient';

import { PublicKey, Field } from 'snarkyjs';

let transactionFee = 0.1;

export default function App() {
  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    currentNum: null as null | Field,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
    proofTime: null as null | string,
    compileTime: null as null | string,
    txLink: null as null | string,
    txMsg: null as null | string,
  });

	function consolelog(msg: string) {
	
		console.log(msg);
		setState({ ...state, txMsg: msg });
	}

  // -------------------------------------------------------
  // Do Setup

	
  useEffect(() => {
    (async () => {
      if (!state.hasBeenSetup) {
        const zkappWorkerClient = new ZkappWorkerClient();

		function formatWinstonTime(ms: number): string {
			if (ms === undefined) return '';
			if (ms < 1000) return ms.toString() + ' ms';
			if (ms < 600 * 1000) return parseInt((ms / 1000).toString()).toString() + ' sec';
			if (ms < 60 * 60 * 1000) return parseInt((ms / 1000 / 60).toString()).toString() + ' min';
			return parseInt((ms / 1000 / 60 / 60).toString()).toString() + ' h';
		}

		const startTime = Date.now();
        consolelog('Loading SnarkyJS library...');
        await zkappWorkerClient.loadSnarkyJS();
        consolelog('done');

        await zkappWorkerClient.setActiveInstanceToBerkeley();
/*
        const mina = (window as any).mina;

        if (mina == null) {
          setState({ ...state, hasWallet: false });
          return;
        }

        const publicKeyBase58: string = (await mina.requestAccounts())[0];
        const publicKey = PublicKey.fromBase58(publicKeyBase58);

        console.log('using key', publicKey.toBase58());

        console.log('checking if account exists...');
        const res = await zkappWorkerClient.fetchAccount({
          publicKey: publicKey!,
        });
        const accountExists = res.error == null;
*/
		const accountExists = true;
        await zkappWorkerClient.loadContract();

        consolelog('compiling zkApp');
        await zkappWorkerClient.compileContract();
        consolelog('zkApp compiled');

        const zkappPublicKey = PublicKey.fromBase58(
          'B62qkw5weoRr9pxGHT8ZmGo4VbQC7uHhvwXYvnxmkAFXya7kuJ7ztb6'
        );

        await zkappWorkerClient.initZkappInstance(zkappPublicKey);

        consolelog('getting zkApp state...');
        await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey });
        const currentNum = await zkappWorkerClient.getNum();
        console.log(' current state:', currentNum.toString());
        const proofTime = "approx. one minute";

        const txLink = "";
        
        const endTime = Date.now();
		const compileTime = formatWinstonTime(endTime-startTime);

        setState({
          ...state,
          zkappWorkerClient,
          hasWallet: true,
          hasBeenSetup: true,
          //publicKey,
          zkappPublicKey,
          accountExists,
          currentNum,
          proofTime,
          txLink,
          compileTime
        });
      }
    })();
  }, []);

/*
  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (;;) {
          console.log('checking if account exists...');
          const res = await state.zkappWorkerClient!.fetchAccount({
            publicKey: state.publicKey!,
          });
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, accountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);
*/
  // -------------------------------------------------------
  // Send a transaction

  const onSendTransaction = async () => {
    setState({ ...state, creatingTransaction: true });
    console.log('sending a transaction...');

	/*
    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.publicKey!,
    });
	*/
	
	function formatWinstonTime(ms: number): string {
		if (ms === undefined) return '';
		if (ms < 1000) return ms.toString() + ' ms';
		if (ms < 600 * 1000) return parseInt((ms / 1000).toString()).toString() + ' sec';
		if (ms < 60 * 60 * 1000) return parseInt((ms / 1000 / 60).toString()).toString() + ' min';
		return parseInt((ms / 1000 / 60 / 60).toString()).toString() + ' h';
	}

	const startTime = Date.now();
	
    await state.zkappWorkerClient!.createUpdateTransaction();

    consolelog('\ncreating proof...');
    await state.zkappWorkerClient!.proveUpdateTransaction();

    consolelog('\nSending transaction...');
    const txLink : string = String(await state.zkappWorkerClient!.getTransactionJSON());

/*
    console.log('requesting send transaction...');
    try {
		const { hash } = await (window as any).mina.sendTransaction({
		  transaction: transactionJSON,
		  feePayer: {
			fee: transactionFee,
			memo: '',
		  },
		});

		console.log(
		  'See transaction at https://berkeley.minaexplorer.com/transaction/' + hash
		);
	} catch (error) {
		console.error(error);
	}
*/
	const endTime = Date.now();
	const delay = formatWinstonTime(endTime-startTime);
	let txMsg = "\nFailure! Unable to send transaction";
	if( txLink !== "") txMsg = `
		 Success! Update transaction sent. Proof took ${delay}

		 Your smart contract state will be updated
		 as soon as the transaction is included in a block (approx. 3 minutes):
		 
		 `;
	consolelog(txMsg);
    setState({ ...state, creatingTransaction: false, proofTime: delay, txLink });
  };

  // -------------------------------------------------------
  // Refresh the current state

  const onRefreshCurrentNum = async () => {
    console.log('getting zkApp state...');
    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.zkappPublicKey!,
    });
    const currentNum = await state.zkappWorkerClient!.getNum();
    console.log('current state:', currentNum.toString());

    setState({ ...state, currentNum });
  };

  // -------------------------------------------------------
  // Create UI elements

  let hasWallet;
  if (state.hasWallet != null && !state.hasWallet) {
    const auroLink = 'https://www.aurowallet.com/';
    const auroLinkElem = (
      <a href={auroLink} target="_blank" rel="noreferrer">
        {' '}
        [Link]{' '}
      </a>
    );
    hasWallet = (
      <div>
        {' '}
        Could not find a wallet. Install Auro wallet here: {auroLinkElem}
      </div>
    );
  }

  let setupText = state.hasBeenSetup
    ? 'Genie ZK contract is ready (compilation took ' + state.compileTime + ')'
    : 'Loading and compiling Genie ZK contract (takes few minutes)...';
  let setup = (
    <div>
      {' '}
      {setupText} {hasWallet}
    </div>
  );

  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink =
      'https://faucet.minaprotocol.com/?address=' + state.publicKey!.toBase58();
    accountDoesNotExist = (
      <div>
        Account does not exist. Please visit the faucet to fund this account
        <a href={faucetLink} target="_blank" rel="noreferrer">
          {' '}
          [Link]{' '}
        </a>
      </div>
    );
  }

  let mainContent;
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = (
      <div>
        <button
          onClick={onSendTransaction}
          disabled={state.creatingTransaction}
        >
          {' '}
          Increase Valuation
        </button>
        <div> Jug valuation: {state.currentNum!.toString()} megayards </div>
        <button onClick={onRefreshCurrentNum}> Get Latest Valuation </button>

      </div>
    );
  }

  return (
    <div>
      <div> 
		  {setup}
		  {accountDoesNotExist}
		  {mainContent}
	  </div>
	 <div>{state.txMsg}</div>
      	<div>
          <a href={String(state.txLink)} target="_blank" rel="noreferrer"> {state.txLink}</a>
      	</div>
      <div> 
      	<img src="https://dfstio.github.io/04-zkapp-browser-ui/genie.jpg" width={400} height={400}/>
      </div>
    </div>
  );
}