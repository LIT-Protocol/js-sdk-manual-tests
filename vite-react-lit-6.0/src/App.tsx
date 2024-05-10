import "./App.css";
import {
  LitNodeClient,
  encryptString,
  decryptToString,
} from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";
import {
  LitPKPResource,
  LitActionResource,
  generateAuthSig,
  createSiweMessageWithRecaps,
  LitAccessControlConditionResource,
} from "@lit-protocol/auth-helpers";
import { LitAbility } from "@lit-protocol/types";
import { AuthCallbackParams } from "@lit-protocol/types";
import { ethers } from "ethers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { LIT_CHAIN_RPC_URL, LIT_CHAINS } from "@lit-protocol/constants";
import { ethConnect, solConnect } from "@lit-protocol/auth-browser";
import { EOA_PRIVATE_KEY } from "./tests/config";
import { testDiscordAuthMethod } from "./tests/testDiscordAuthMethod";
import { testGoogleAuthMethod } from "./tests/testGoogleAuthMethod";

export const WALLET_CONNECT_PROJECT_ID = "34104ffa79c42bc7a3da115a421b80c7";

function App() {
  const runWithPrivateKeyEoaWallet = async () => {
    console.log("🔥 LET'S GO!");
    const litNodeClient = new LitNodeClient({
      litNetwork: LitNetwork.Cayenne,
    });

    console.log("Connecting to LitNode...");
    await litNodeClient.connect();

    const wallet = new ethers.Wallet(
      EOA_PRIVATE_KEY,
      new ethers.providers.JsonRpcProvider(LIT_CHAIN_RPC_URL)
    );

    const latestBlockhash = await litNodeClient.getLatestBlockhash();
    console.log("latestBlockhash:", latestBlockhash);

    // mint a pkp
    const litContracts = new LitContracts({
      signer: wallet,
      debug: false,
      network: LitNetwork.Cayenne,
    });

    await litContracts.connect();

    const pkp = (await litContracts.pkpNftContractUtils.write.mint()).pkp;
    console.log("✅ pkp:", pkp);

    const sessionSigs = await litNodeClient.getSessionSigs({
      resourceAbilityRequests: [
        {
          resource: new LitPKPResource("*"),
          ability: LitAbility.PKPSigning,
        },
        {
          resource: new LitActionResource("*"),
          ability: LitAbility.LitActionExecution,
        },
      ],
      authNeededCallback: async (params: AuthCallbackParams) => {
        if (!params.uri) {
          throw new Error("uri is required");
        }
        if (!params.expiration) {
          throw new Error("expiration is required");
        }

        if (!params.resourceAbilityRequests) {
          throw new Error("resourceAbilityRequests is required");
        }

        const toSign = await createSiweMessageWithRecaps({
          uri: params.uri,
          expiration: params.expiration,
          resources: params.resourceAbilityRequests,
          walletAddress: wallet.address,
          nonce: latestBlockhash,
          litNodeClient,
        });

        const authSig = await generateAuthSig({
          signer: wallet,
          toSign,
        });

        return authSig;
      },
    });

    console.log("✅ sessionSigs:", sessionSigs);

    // -- executeJs
    const executeJsRes = await litNodeClient.executeJs({
      code: `(async () => {
        const sigShare = await LitActions.signEcdsa({
          toSign: dataToSign,
          publicKey,
          sigName: "sig",
        });
      })();`,
      sessionSigs,
      jsParams: {
        dataToSign: ethers.utils.arrayify(
          ethers.utils.keccak256([1, 2, 3, 4, 5])
        ),
        publicKey: pkp.publicKey,
      },
    });

    console.log("✅ executeJsRes:", executeJsRes);

    // -- pkpSign
    const pkpSignRes = await litNodeClient.pkpSign({
      pubKey: pkp.publicKey,
      sessionSigs: sessionSigs,
      toSign: ethers.utils.arrayify(ethers.utils.keccak256([1, 2, 3, 4, 5])),
    });

    console.log("✅ pkpSignRes:", pkpSignRes);

    // -- encryptString

    const accs = [
      {
        contractAddress: "",
        standardContractType: "",
        chain: "ethereum",
        method: "",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: "=",
          value: wallet.address,
        },
      },
    ];

    const encryptRes = await encryptString(
      {
        accessControlConditions: accs,
        dataToEncrypt: "Hello world",
      },
      litNodeClient
    );

    console.log("✅ encryptRes:", encryptRes);

    // -- decrypt string
    const accsResourceString =
      await LitAccessControlConditionResource.generateResourceString(
        accs,
        encryptRes.dataToEncryptHash
      );

    const sessionSigsToDecryptThing = await litNodeClient.getSessionSigs({
      resourceAbilityRequests: [
        {
          resource: new LitAccessControlConditionResource(accsResourceString),
          ability: LitAbility.AccessControlConditionDecryption,
        },
      ],
      authNeededCallback: async (params: AuthCallbackParams) => {
        if (!params.uri) {
          throw new Error("uri is required");
        }
        if (!params.expiration) {
          throw new Error("expiration is required");
        }

        if (!params.resourceAbilityRequests) {
          throw new Error("resourceAbilityRequests is required");
        }

        const toSign = await createSiweMessageWithRecaps({
          uri: params.uri,
          expiration: params.expiration,
          resources: params.resourceAbilityRequests,
          walletAddress: wallet.address,
          nonce: latestBlockhash,
          litNodeClient,
        });

        const authSig = await generateAuthSig({
          signer: wallet,
          toSign,
        });

        return authSig;
      },
    });

    // -- Decrypt the encrypted string
    const decryptRes = await decryptToString(
      {
        accessControlConditions: accs,
        ciphertext: encryptRes.ciphertext,
        dataToEncryptHash: encryptRes.dataToEncryptHash,
        sessionSigs: sessionSigsToDecryptThing,
        chain: "ethereum",
      },
      litNodeClient
    );

    console.log("✅ decryptRes:", decryptRes);
  };
  const runWithCustomBrowserSigner = async () => {
    console.log("🔥 LET'S GO!");
    const litNodeClient = new LitNodeClient({
      litNetwork: LitNetwork.Cayenne,
    });

    console.log("Connecting to LitNode...");
    await litNodeClient.connect();

    const wallet = new ethers.Wallet(
      EOA_PRIVATE_KEY,
      new ethers.providers.JsonRpcProvider(LIT_CHAIN_RPC_URL)
    );

    const latestBlockhash = await litNodeClient.getLatestBlockhash();
    console.log("latestBlockhash:", latestBlockhash);

    // mint a pkp
    const litContracts = new LitContracts({
      signer: wallet,
      debug: false,
      network: LitNetwork.Cayenne,
    });

    await litContracts.connect();

    const pkp = (await litContracts.pkpNftContractUtils.write.mint()).pkp;
    console.log("✅ pkp:", pkp);

    const sessionSigs = await litNodeClient.getSessionSigs({
      resourceAbilityRequests: [
        {
          resource: new LitPKPResource("*"),
          ability: LitAbility.PKPSigning,
        },
        {
          resource: new LitActionResource("*"),
          ability: LitAbility.LitActionExecution,
        },
      ],
      authNeededCallback: async (params: AuthCallbackParams) => {
        if (!params.uri) {
          throw new Error("uri is required");
        }
        if (!params.expiration) {
          throw new Error("expiration is required");
        }

        if (!params.resourceAbilityRequests) {
          throw new Error("resourceAbilityRequests is required");
        }

        // example of using custom signer
        const litConnectModal = await ethConnect.connectWeb3({
          chainId: LIT_CHAINS["chronicleTestnet"].chainId,
          walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
        });

        const litConnectModalSigner = litConnectModal.web3.getSigner();

        const toSign = await createSiweMessageWithRecaps({
          uri: params.uri,
          expiration: params.expiration,
          resources: params.resourceAbilityRequests,
          walletAddress: litConnectModalSigner.address, // <-- using the signer address
          nonce: latestBlockhash,
          litNodeClient,
        });

        const authSig = await generateAuthSig({
          signer: litConnectModalSigner, // <-- using the signer
          toSign,
        });

        return authSig;
      },
    });

    console.log("✅ sessionSigs:", sessionSigs);

    // -- executeJs
    const executeJsRes = await litNodeClient.executeJs({
      code: `(async () => {
        const sigShare = await LitActions.signEcdsa({
          toSign: dataToSign,
          publicKey,
          sigName: "sig",
        });
      })();`,
      sessionSigs,
      jsParams: {
        dataToSign: ethers.utils.arrayify(
          ethers.utils.keccak256([1, 2, 3, 4, 5])
        ),
        publicKey: pkp.publicKey,
      },
    });

    console.log("✅ executeJsRes:", executeJsRes);

    // -- pkpSign
    const pkpSignRes = await litNodeClient.pkpSign({
      pubKey: pkp.publicKey,
      sessionSigs: sessionSigs,
      toSign: ethers.utils.arrayify(ethers.utils.keccak256([1, 2, 3, 4, 5])),
    });

    console.log("✅ pkpSignRes:", pkpSignRes);

    // -- encryptString
    const accs = [
      {
        contractAddress: "",
        standardContractType: "",
        chain: "ethereum",
        method: "",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: "=",
          value: wallet.address,
        },
      },
    ];

    const encryptRes = await encryptString(
      {
        accessControlConditions: accs,
        dataToEncrypt: "Hello world",
      },
      litNodeClient
    );

    console.log("✅ encryptRes:", encryptRes);

    // -- decrypt string
    const accsResourceString =
      await LitAccessControlConditionResource.generateResourceString(
        accs,
        encryptRes.dataToEncryptHash
      );

    const sessionSigsToDecryptThing = await litNodeClient.getSessionSigs({
      resourceAbilityRequests: [
        {
          resource: new LitAccessControlConditionResource(accsResourceString),
          ability: LitAbility.AccessControlConditionDecryption,
        },
      ],
      authNeededCallback: async (params: AuthCallbackParams) => {
        if (!params.uri) {
          throw new Error("uri is required");
        }
        if (!params.expiration) {
          throw new Error("expiration is required");
        }

        if (!params.resourceAbilityRequests) {
          throw new Error("resourceAbilityRequests is required");
        }

        const toSign = await createSiweMessageWithRecaps({
          uri: params.uri,
          expiration: params.expiration,
          resources: params.resourceAbilityRequests,
          walletAddress: wallet.address,
          nonce: latestBlockhash,
          litNodeClient,
        });

        const authSig = await generateAuthSig({
          signer: wallet,
          toSign,
        });

        return authSig;
      },
    });

    // -- Decrypt the encrypted string
    const decryptRes = await decryptToString(
      {
        accessControlConditions: accs,
        ciphertext: encryptRes.ciphertext,
        dataToEncryptHash: encryptRes.dataToEncryptHash,
        sessionSigs: sessionSigsToDecryptThing,
        chain: "ethereum",
      },
      litNodeClient
    );

    console.log("✅ decryptRes:", decryptRes);
  };

  const getSolanaAuthSig = async () => {
    const litNodeClient = new LitNodeClient({
      litNetwork: LitNetwork.Cayenne,
    });

    await litNodeClient.connect();

    const authSig = await solConnect.checkAndSignSolAuthMessage();
    console.log(JSON.stringify(authSig));

    const accs = [
      {
        method: "",
        params: [":userAddress"],
        pdaParams: [],
        pdaInterface: { offset: 0, fields: {} },
        pdaKey: "",
        chain: "solana",
        returnValueTest: {
          key: "",
          comparator: "=",
          value: authSig.address,
        },
      },
    ];

    const encryptRes = await encryptString(
      {
        solRpcConditions: accs,
        dataToEncrypt: "Hello world",
      },
      litNodeClient
    );

    console.log("✅ encryptRes:", encryptRes);

    // -- Decrypt the encrypted string
    const decryptRes = await decryptToString(
      {
        solRpcConditions: accs,
        ciphertext: encryptRes.ciphertext,
        dataToEncryptHash: encryptRes.dataToEncryptHash,
        authSig: authSig,
        chain: "solana",
      },
      litNodeClient
    );

    console.log("decryptRes:", decryptRes);
  };

  // FIXME: doesn't work
  // const getCosmosAuthSig = async () => {
  //   console.log("Get cosmos auth sig");
  //   const authSig = await cosmosConnect.checkAndSignCosmosAuthMessage({
  //     chain: "cosmos",
  //     walletType: "keplr",
  //   });
  //   console.log(JSON.stringify(authSig));
  //   const litNodeClient = new LitNodeClient({
  //     litNetwork: LitNetwork.Cayenne,
  //   });

  //   await litNodeClient.connect();

  //   const accs = [
  //     {
  //       conditionType: "cosmos",
  //       path: ":userAddress",
  //       chain: "cosmos",
  //       returnValueTest: {
  //         key: "",
  //         comparator: "=",
  //         value: authSig.address,
  //       },
  //     },
  //   ];

  //   const encryptRes = await encryptString(
  //     {
  //       authSig: authSig,
  //       chain: "cosmos",
  //       unifiedAccessControlConditions: accs,
  //       dataToEncrypt: "Hello world",
  //     },
  //     litNodeClient
  //   );

  //   console.log("✅ encryptRes:", encryptRes);

  //   // -- Decrypt the encrypted string
  //   const decryptRes = await decryptToString(
  //     {
  //       unifiedAccessControlConditions: accs,
  //       ciphertext: encryptRes.ciphertext,
  //       dataToEncryptHash: encryptRes.dataToEncryptHash,
  //       authSig: authSig,
  //       chain: "cosmos",
  //     },
  //     litNodeClient
  //   );

  //   console.log("decryptRes:", decryptRes);
  // };

  return (
    <>
      <h1>vite-react-lit-6.0</h1>
      <div className="card">
        <button onClick={async () => await runWithPrivateKeyEoaWallet()}>
          runWithPrivateKeyEoaWallet
        </button>
        <hr />
        <button onClick={async () => await runWithCustomBrowserSigner()}>
          runWithCustomBrowserSigner
        </button>
        <hr />
        <button onClick={async () => await testDiscordAuthMethod()}>
          testDiscordAuthMethod
        </button>
        <hr />
        <button onClick={async () => await testGoogleAuthMethod()}>
          testGoogleAuthMethod
        </button>
        <hr />
        <button onClick={async () => await getSolanaAuthSig()}>
          getSolanaAuthSig
        </button>
        <hr />
        {/* <button onClick={async () => await getCosmosAuthSig()}>
          getCosmosAuthSig
        </button> */}
        <hr />
      </div>
    </>
  );
}

export default App;
