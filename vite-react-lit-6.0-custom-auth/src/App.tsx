import { useState } from "react";
import Editor from "@monaco-editor/react";
import { ethers } from "ethers";

import { TestEnv, getConfig } from "./tests/config";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { AuthMethodScope } from "@lit-protocol/constants";
import { LitPKPResource, LitActionResource } from "@lit-protocol/auth-helpers";
import { LitAbility } from "@lit-protocol/types";
import { stringToIpfsHash } from "./utils";

const ENV: TestEnv = TestEnv.CAYENNE_BROWSER;

const App = () => {
  const [litContracts, setLitContracts] = useState<LitContracts | null>(null);
  const [litNodeClient, setLitNodeClient] = useState<LitNodeClient | null>(
    null
  );
  const [pkp, setPkp] = useState<{
    tokenId: string;
    publicKey: string;
    ethAddress: string;
  } | null>(null);
  const [customAuthMethod] = useState({
    authMethodType: 89989,
    authMethodId: "app-id-xxx:user-id-yyy",
  });
  const [addPermittedAuthMethodHash, setAddPermittedAuthMethodHash] = useState<
    string | null
  >(null);
  const [litActionCode] = useState<string>(`(async () => {
  const tokenId = await Lit.Actions.pubkeyToTokenId({ publicKey: pkpPublicKey });
  const permittedAuthMethods = await Lit.Actions.getPermittedAuthMethods({ tokenId });
  const isPermitted = permittedAuthMethods.some((permittedAuthMethod) => {
    if (permittedAuthMethod["auth_method_type"] === "0x15f85" && 
        permittedAuthMethod["id"] === customAuthMethod.authMethodId) {
      return true;
    }
    return false;
  });
  LitActions.setResponse({ response: isPermitted ? "true" : "false" });
})();`);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);
  const [permittedActionHash, setPermittedActionHash] = useState<string | null>(
    null
  );
  const [sessionSigs, setSessionSigs] = useState<any | null>(null);
  const [pkpSignResponse, setPkpSignResponse] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);

  const executeStep = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
      setStep(step + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const setupEnv = async () => {
    const envConfig = await getConfig(ENV);
    if (!litContracts) {
      const _litContracts = new LitContracts(envConfig.contractSdk);
      await _litContracts.connect();
      setLitContracts(_litContracts);
    }
    if (!litNodeClient) {
      const _litNodeClient = new LitNodeClient(envConfig.litNodeClient);
      await _litNodeClient.connect();
      setLitNodeClient(_litNodeClient);
    }
  };

  const useEoaWalletToMintPkp = async () => {
    const eoaWalletOwnedPkp = (
      await litContracts!.pkpNftContractUtils.write.mint()
    ).pkp;
    setPkp(eoaWalletOwnedPkp);
  };

  const addPermittedAuthMethod = async () => {
    const receipt = await litContracts!.addPermittedAuthMethod({
      pkpTokenId: pkp!.tokenId,
      authMethodType: customAuthMethod.authMethodType,
      authMethodId: customAuthMethod.authMethodId,
      authMethodScopes: [AuthMethodScope.SignAnything],
    });
    setAddPermittedAuthMethodHash(receipt.transactionHash);
  };

  const convertCodeToIpfsHash = async () => {
    const IPFSID = await stringToIpfsHash(litActionCode);
    setIpfsHash(IPFSID);
  };

  const permitLitAction = async () => {
    const receipt = await litContracts!.addPermittedAction({
      ipfsId: ipfsHash!,
      pkpTokenId: pkp!.tokenId,
      authMethodScopes: [AuthMethodScope.SignAnything],
    });
    setPermittedActionHash(receipt.transactionHash);
  };

  const getSessionSigs = async () => {
    const litActionSessionSigs = await litNodeClient!.getLitActionSessionSigs({
      pkpPublicKey: pkp!.publicKey,
      resourceAbilityRequests: [
        { resource: new LitPKPResource("*"), ability: LitAbility.PKPSigning },
        {
          resource: new LitActionResource("*"),
          ability: LitAbility.LitActionExecution,
        },
      ],
      litActionCode: Buffer.from(litActionCode).toString("base64"),
      jsParams: {
        pkpPublicKey: pkp!.publicKey,
        customAuthMethod: {
          authMethodType: `0x${customAuthMethod.authMethodType.toString(16)}`,
          authMethodId: `0x${Buffer.from(
            new TextEncoder().encode(customAuthMethod.authMethodId)
          ).toString("hex")}`,
        },
        sigName: "custom-auth-sig",
      },
    });
    setSessionSigs(litActionSessionSigs);
  };

  const pkpSign = async () => {
    const res = await litNodeClient!.pkpSign({
      pubKey: pkp!.publicKey,
      sessionSigs: sessionSigs!,
      toSign: ethers.utils.arrayify(ethers.utils.keccak256([1, 2, 3, 4, 5])),
    });
    setPkpSignResponse(res);
  };

  return (
    <div>
      <h5>Env: {JSON.stringify(ENV)}</h5>
      <a
        href="https://github.com/LIT-Protocol/js-sdk-manual-tests/blob/main/vite-react-lit-6.0-custom-auth/src/App.tsx"
        target="_blank"
      >
        https://github.com/LIT-Protocol/js-sdk-manual-tests/blob/main/vite-react-lit-6.0-custom-auth/src/App.tsx
      </a>
      <p>
        <b>Step 1</b> - Setup LitContracts and LitNodeClient.
      </p>

      {/* Step 1: Mint PKP */}
      <button
        onClick={() => executeStep(setupEnv)}
        disabled={step !== 0 || loading}
      >
        {loading && step === 0 ? "Setting up..." : "Setup"}
      </button>

      {litNodeClient && <p>✅ litNodeClient is connected.</p>}
      {litContracts && <p>✅ litContracts is connected.</p>}
      <p>
        <b>Step 2</b> - Alice mints a PKP using her EOA wallet
      </p>
      <button
        onClick={() => executeStep(useEoaWalletToMintPkp)}
        disabled={step !== 1 || loading}
      >
        {loading && step === 1 ? "Minting PKP..." : "Mint PKP"}
      </button>

      {pkp && (
        <ul>
          <li>✅ tokenId: {pkp.tokenId}</li>
          <li>✅ publicKey: {pkp.publicKey}</li>
          <li>✅ ethAddress: {pkp.ethAddress}</li>
        </ul>
      )}
      <hr />
      {/* Step 2: Add Permitted Auth Method */}
      <p>
        <b>Step 3</b> - Permit the custom auth method to use the Alice's PKP, so
        we can check this in the Lit Action by calling the
        `getPermittedAuthMethods` method.
      </p>

      {step === 2 && (
        <Editor
          height="100px"
          defaultLanguage="typescript"
          value={`const customAuthMethod = ${JSON.stringify(
            customAuthMethod,
            null,
            2
          )}`}
        />
      )}

      <button
        onClick={() => executeStep(addPermittedAuthMethod)}
        disabled={step !== 2 || loading}
      >
        {loading && step === 2
          ? "Adding Permitted Auth Method..."
          : "Add Permitted Auth Method"}
      </button>

      {addPermittedAuthMethodHash && (
        <p>✅ Hash: {addPermittedAuthMethodHash}</p>
      )}
      <hr />

      {/* Step 3: Convert Code to IPFS Hash */}
      {step === 3 && (
        <Editor
          height="230px"
          defaultLanguage="typescript"
          value={litActionCode}
        />
      )}
      <p>
        <b>Step 4</b> - Convert the Lit Action code to an IPFS CID, so we can
        permit the action.
      </p>
      <button
        onClick={() => executeStep(convertCodeToIpfsHash)}
        disabled={step !== 3 || loading}
      >
        {loading && step === 3
          ? "Converting to IPFS Hash..."
          : "Convert to IPFS Hash"}
      </button>

      {ipfsHash && <p>✅ IPFS CID: {ipfsHash}</p>}
      <hr />

      {/* Step 4: Permit Lit Action */}
      <p>
        <b>Step 5</b> - Permit the Lit Action to use Alice's PKP.
      </p>
      <button
        onClick={() => executeStep(permitLitAction)}
        disabled={step !== 4 || loading}
      >
        {loading && step === 4
          ? `Permitting ${ipfsHash}...`
          : `Permit ${ipfsHash}`}
      </button>

      {permittedActionHash && <p>✅ Hash: {permittedActionHash}</p>}
      <hr />
      {/* Step 5: Get Session Sigs */}
      <p>
        <b>Step 6</b> - Get the session signatures, so that we can use Alice's
        PKP to sign.
      </p>

      <button
        onClick={() => executeStep(getSessionSigs)}
        disabled={step !== 5 || loading}
      >
        {loading && step === 5 ? "Getting Session Sigs..." : "Get Session Sigs"}
      </button>

      {sessionSigs && (
        <Editor
          height="50px"
          defaultLanguage="json"
          value={JSON.stringify(sessionSigs)}
        />
      )}
      <hr />
      {/* Step 6: PKP Sign */}
      <p>
        <b>Step 7</b> - Alice signs the session with her PKP.
      </p>
      <button
        onClick={() => executeStep(pkpSign)}
        disabled={step !== 6 || loading}
      >
        {loading && step === 6 ? "Signing with PKP..." : "PKP Sign"}
      </button>
      {pkpSignResponse && (
        <Editor
          height="150px"
          defaultLanguage="json"
          value={JSON.stringify(pkpSignResponse, null, 2)}
        />
      )}
    </div>
  );
};

export default App;
