import { LIT_CHAINS, LitNetwork, ProviderType } from "@lit-protocol/constants";
import { AuthCallbackParams, SessionKeyPair } from "@lit-protocol/types";
import { DiscordProvider, LitAuthClient } from "@lit-protocol/lit-auth-client";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import {
  LitAbility,
  LitActionResource,
  LitPKPResource,
} from "@lit-protocol/auth-helpers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { ethers } from "ethers";
import { useEffect, useState } from "react";

/**
 * ==================== CONFIGURATION ====================
 */
const RELAY_API_KEY = "____________YOUR RELAYER API KEY_____________";
const EOA_PRIVATE_KEY = "____________YOUR EOA PRIVATE KEY_____________";
const RELAY_RPC_URL = "https://habanero-relayer.getlit.dev";
const DISCORD_REDIRECT_URI = "http://localhost:5173";

function App() {
  // It's just visual cue here, not important for the process
  // of getting session sigs
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("provider") === "discord") {
      setIsSignedIn(true);
    }
  });

  /**
   * Main function to run the process of getting session sigs and pkp sign using Discord Auth
   */
  async function go() {
    /**
     * ========== Lit Node Client ==========
     */
    console.log("Connecting to Lit Nodes...");
    const litNodeClient = new LitNodeClient({
      litNetwork: LitNetwork.Habanero,
    });

    await litNodeClient.connect();
    console.log("✅ LitNodeClient connected!");

    /**
     * ========== Lit Contracts SDK to create a capacity delegation authSig ==========
     */
    const rpcProvider = new ethers.providers.JsonRpcProvider(
      LIT_CHAINS["chronicleTestnet"].rpcUrls[0]
    );
    const ethersWallet = new ethers.Wallet(EOA_PRIVATE_KEY, rpcProvider);

    const litContractsClient = new LitContracts({
      network: LitNetwork.Habanero,
      signer: ethersWallet,
    });

    await litContractsClient.connect();

    const { capacityTokenIdStr } =
      await litContractsClient.mintCapacityCreditsNFT({
        requestsPerKilosecond: 100,
        daysUntilUTCMidnightExpiration: 2,
      });

    const capacityDelegationAuthSig = await (
      await litNodeClient.createCapacityDelegationAuthSig({
        dAppOwnerWallet: ethersWallet,
        capacityTokenId: capacityTokenIdStr,
      })
    ).capacityDelegationAuthSig;

    /**
     * ========== Lit Auth Client ==========
     */
    console.log("Setting up Discord Auth provider...");
    const litAuthClient = new LitAuthClient({
      litRelayConfig: {
        relayUrl: RELAY_RPC_URL,
        relayApiKey: RELAY_API_KEY,
      },
      litNodeClient,
    });

    const discordProvider = litAuthClient.initProvider<DiscordProvider>(
      ProviderType.Discord,
      {
        redirectUri: DISCORD_REDIRECT_URI,
      }
    );
    console.log("✅ DiscordProvider initialized!", discordProvider);

    /**
     * ========== Sign in Discord ==========
     */
    // If ?provider=discord is not found in the URL, redirect to Discord OAuth
    const url = new URL(window.location.href);
    if (url.searchParams.get("provider") !== "discord") {
      console.log("Signing in with Discord...");
      discordProvider.signIn();
    }

    /**
     * ========== Authenticate ==========
     */
    console.log("Discord is signed in! Authenticating...");

    // Handle authentication
    const authMethod = await discordProvider.authenticate();
    console.log("✅ DiscordProvider authMethod:", authMethod);

    /**
     * ========== Fetch PKPs by auth method. If no PKPs, then mint one ==========
     */
    console.log("Fetching PKPs through Relayer...");
    const currentPkps = await discordProvider.fetchPKPsThroughRelayer(
      authMethod
    );

    // If the user has already minted, then skip minting
    if (currentPkps.length <= 0) {
      // mint a PKP with auth method
      console.log("Minting PKP with Discord Auth Method...");
      const txHash = await discordProvider.mintPKPThroughRelayer(authMethod);
      console.log(`✅ https://chain.litprotocol.com/tx/${txHash}`);
    }

    console.log("Fetching PKPs through Relayer again...");
    const pkps = await discordProvider.fetchPKPsThroughRelayer(authMethod);
    console.log("✅ discord auth auth method owned pkp:", pkps);

    /**
     * ========== Use the last PKP from the discord auth method ==========
     */
    const lastDiscordAuthMethodOwnedPkp: {
      publicKey: string;
      ethAddress: string;
      tokenId: string;
    } = pkps[pkps.length - 1];

    /**
     * ========== Get Session Sigs  ==========
     */
    console.log("Getting session sigs...");
    const sessionSigs = await litNodeClient.getSessionSigs({
      // pkpPublicKey: dicordAuthMethodOwnedPkp.publicKey, // Optional in 6.0.0
      // authMethods: [authMethod], // Optional in 6.0.0
      chain: "ethereum", // If this is omitted in 6.0.0, it will default to "ethereum"
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
      capacityDelegationAuthSig: capacityDelegationAuthSig,
      // AuthCallbackParams (6.0.0) would include sessionKey. Here, we are using the old way of passing sessionKey.
      authNeededCallback: async (
        props: AuthCallbackParams & { sessionKey: SessionKeyPair } & any
      ) => {
        console.log("authNeededCallback props:", props);

        const response = await litNodeClient.signSessionKey({
          sessionKey: props.sessionKey,
          statement: props.statement || "Some custom statement.",
          authMethods: [authMethod],
          pkpPublicKey: lastDiscordAuthMethodOwnedPkp.publicKey,
          expiration: props.expiration,
          resources: props.resources,
          chainId: 1,
          resourceAbilityRequests: props.resourceAbilityRequests,
        });

        return response.authSig;
      },
    });

    console.log("✅ sessionSigs:", sessionSigs);

    /**
     * ========== pkp sign  ==========
     */
    console.log("PKP Signing...");
    const pkpRes = await litNodeClient.pkpSign({
      sessionSigs: sessionSigs,
      authMethods: [authMethod],
      pubKey: lastDiscordAuthMethodOwnedPkp.publicKey,
      toSign: ethers.utils.arrayify(ethers.utils.keccak256([1, 2, 3, 4, 5])),
    });

    console.log("✅ pkpSign response:", pkpRes);
  }

  return (
    <>
      <h1>
        User is{" "}
        {isSignedIn
          ? "signed-in. Authenticate now!"
          : "not signed-in. Redirect to Discord OAuth."}
      </h1>
      <button onClick={go}>Go!</button>
    </>
  );
}

export default App;
