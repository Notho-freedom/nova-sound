export async function spawnTask<T>(type: string, payload: T) {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => "Task spawn failed")
    throw new Error(message)
  }

  return response.json()
}
