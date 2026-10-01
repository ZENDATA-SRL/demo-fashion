import { arg, main } from "../lib/cli"
import { getGarment, setStatus, simulateOperator } from "../lib/garment"

/** Re-import operator GLB for before/after compare. npm run mesh:operator -- [--garment id] [--glb path] */
main(async () => {
  const gid = arg("garment") ?? "g_mupr1ayauch6"
  const glb = arg("glb") ?? process.env.DEMO_OPERATOR_GLB
  if (!glb) throw new Error("serve --glb o DEMO_OPERATOR_GLB")

  const { assets } = await getGarment(gid)
  for (const a of assets.filter((x) => x.kind === "mesh")) {
    if (a.status === "approved") await setStatus(a.id, "draft")
    if (a.label === "operatore") await setStatus(a.id, "rejected")
  }

  await simulateOperator(gid, glb)
  const live = (await getGarment(gid)).assets.filter((x) => x.kind === "mesh" && x.status !== "rejected")
  for (const a of live) console.log(a.status, a.label ?? a.gen?.modelId, a.media.file)
})
