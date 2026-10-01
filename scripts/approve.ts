import { arg, main } from "../lib/cli"
import { setStatus } from "../lib/garment"

/** npm run approve -- <assetId> [--by nome] · npm run approve -- <assetId> --reject */
main(async () => {
  const assetId = process.argv[2]
  if (!assetId || assetId.startsWith("--")) throw new Error("uso: npm run approve -- <assetId> [--by nome] [--reject]")
  const reject = process.argv.includes("--reject")
  const asset = await setStatus(assetId, reject ? "rejected" : "approved", arg("by"))
  console.log(`${asset.kind} ${asset.id} → ${asset.status}${asset.approvedBy ? ` (${asset.approvedBy})` : ""}`)
})
