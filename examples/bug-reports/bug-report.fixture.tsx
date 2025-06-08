import { useEffect, useState } from "react"
import { AutoroutingPipelineDebugger } from "lib/testing/AutoroutingPipelineDebugger"
import { SimpleRouteJson } from "lib/types"

export default () => {
  const params = new URLSearchParams(window.location.search)
  const bugReportId = params.get("bug_report_id")
  const [srj, setSrj] = useState<SimpleRouteJson | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bugReportId) return
    const url =
      "https://api.tscircuit.com/autorouting/bug_reports/get?autorouting_bug_report_id=" +
      bugReportId +
      "&download=true"
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.autorouting_bug_report) {
          setSrj(data.autorouting_bug_report.simple_route_json)
        } else {
          setError("Bug report not found")
        }
      })
      .catch((err) => {
        console.error(err)
        setError("Failed to load bug report")
      })
  }, [bugReportId])

  if (!bugReportId) {
    return <div className="p-4">No bug_report_id specified in URL.</div>
  }
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }
  if (!srj) {
    return <div className="p-4">Loading bug report...</div>
  }
  return <AutoroutingPipelineDebugger srj={srj} />
}
