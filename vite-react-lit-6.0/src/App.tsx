import { useState } from "react";

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

function App() {
  const go = async () => {
    console.log("🔥 LET'S GO!");
    const litNodeClient = new LitNodeClient({
      litNetwork: LitNetwork.Cayenne,
    });

    console.log("Connecting to LitNode...");
    await litNodeClient.connect();

    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      new ethers.providers.JsonRpcProvider(
        "https://chain-rpc.litprotocol.com/http"
      )
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
        chain: "ethereum",
        sessionSigs: sessionSigs,
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

  return (
    <>
      <h1>vite-react-lit-6.0</h1>
      <div className="card">
        <button onClick={async () => await go()}>go</button>
      </div>
    </>
  );
}

export default App;
