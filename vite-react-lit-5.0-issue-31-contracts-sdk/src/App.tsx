import "./App.css";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { LIT_CHAINS, LitNetwork } from "@lit-protocol/constants";
import { ethers } from "ethers";

const EOA_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const LIT_CHAIN_RPC_URL = LIT_CHAINS["chronicleTestnet"].rpcUrls[0];

function App() {
  const go = async () => {
    console.log("go");
    const wallet = new ethers.Wallet(
      EOA_PRIVATE_KEY,
      new ethers.providers.JsonRpcProvider(LIT_CHAIN_RPC_URL)
    );

    // mint a pkp
    const litContracts = new LitContracts({
      debug: true,
      signer: wallet,
      network: LitNetwork.Cayenne,
    });

    await litContracts.connect();

    console.log("litContracts connected");

    const pkp = (await litContracts.pkpNftContractUtils.write.mint()).pkp;

    console.log("pkp minted:", pkp);
  };

  return (
    <>
      <h1>
        <a
          target="_blank"
          href="https://github.com/LIT-Protocol/Issues-and-Reports/issues/31"
        >
          issues/31
        </a>
      </h1>
      <div className="card">
        <button onClick={() => go()}>Go!</button>
      </div>
    </>
  );
}

export default App;
