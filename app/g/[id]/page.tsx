import { notFound } from "next/navigation"
import { buildWorkspace } from "@/lib/workspace"
import { WorkspaceApp } from "../../ui/workspace"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }

export default async function GarmentPage({ params, searchParams }: Props) {
  const { id } = await params
  const { step } = await searchParams
  const ws = await buildWorkspace(id).catch(() => null)
  if (!ws) notFound()
  return <WorkspaceApp initial={ws} initialStep={step} />
}
