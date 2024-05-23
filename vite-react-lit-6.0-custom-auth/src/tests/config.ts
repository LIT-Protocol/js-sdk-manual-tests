import { ethConnect } from "@lit-protocol/auth-browser";
import { LitNetwork } from "@lit-protocol/constants";
import networkContext from "../networkContext.json";
import { ethers } from "ethers";
import { LIT_CHAIN_RPC_URL, LIT_CHAINS } from "@lit-protocol/constants";

export const EOA_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const WALLET_CONNECT_PROJECT_ID = "34104ffa79c42bc7a3da115a421b80c7";

export enum TestEnv {
  LOCAL_NODE = "local-node",
  LOCAL_BROWSER = "local-browser",
  CAYENNE_NODE = "cayenne",
  CAYENNE_BROWSER = "cayenne-browser",
}

export const CONFIG = {
  getLocalBrowserConfig: async () => {
    // example of using custom signer
    const litConnectModal = await ethConnect.connectWeb3({
      chainId: 31337,
      walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
    });

    const signer = litConnectModal.web3.getSigner();

    return {
      litNodeClient: {
        litNetwork: LitNetwork.Custom,
        bootstrapUrls: [
          "http://127.0.0.1:7470",
          "http://127.0.0.1:7471",
          "http://127.0.0.1:7472",
        ],
        rpcUrl: "http://127.0.0.1:8545",
        debug: true,
        checkNodeAttestation: false, // disable node attestation check for local testing
        contractContext: networkContext as any,
      },
      contractSdk: {
        signer: signer,
        debug: true,
        rpc: "http://127.0.0.1:8545",
        customContext: networkContext as any,
      },
    };
  },
  getLocalNodeConfig: async () => {
    return {
      litNodeClient: {
        litNetwork: LitNetwork.Custom,
        bootstrapUrls: [
          "http://127.0.0.1:7470",
          "http://127.0.0.1:7471",
          "http://127.0.0.1:7472",
        ],
        rpcUrl: "http://127.0.0.1:8545",
        debug: true,
        checkNodeAttestation: false, // disable node attestation check for local testing
        contractContext: networkContext as any,
      },
      contractSdk: {
        signer: new ethers.Wallet(
          EOA_PRIVATE_KEY,
          new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545")
        ),
        debug: true,
        rpc: "http://127.0.0.1:8545",
        customContext: networkContext as any,
      },
    };
  },
  getCayenneConfig: async () => {
    return {
      litNodeClient: {
        litNetwork: LitNetwork.Cayenne,
        debug: true,
      },
      contractSdk: {
        signer: new ethers.Wallet(
          EOA_PRIVATE_KEY,
          new ethers.providers.JsonRpcProvider(LIT_CHAIN_RPC_URL)
        ),
        debug: false,
        network: LitNetwork.Cayenne,
      },
    };
  },
  getCayenneBrowserConfig: async () => {
    const litConnectModal = await ethConnect.connectWeb3({
      chainId: LIT_CHAINS["chronicleTestnet"].chainId,
      walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
    });

    const signer = litConnectModal.web3.getSigner();

    return {
      litNodeClient: {
        litNetwork: LitNetwork.Cayenne,
        debug: true,
      },
      contractSdk: {
        signer: signer,
        debug: false,
        network: LitNetwork.Cayenne,
      },
    };
  },
};

export async function getConfig(env: TestEnv): Promise<any> {
  if (env === TestEnv.LOCAL_NODE) {
    return await CONFIG.getLocalNodeConfig();
  } else if (env === TestEnv.LOCAL_BROWSER) {
    return await CONFIG.getLocalBrowserConfig();
  } else if (env === TestEnv.CAYENNE_NODE) {
    return await CONFIG.getCayenneConfig();
  } else if (env === TestEnv.CAYENNE_BROWSER) {
    return await CONFIG.getCayenneBrowserConfig();
  }
}
