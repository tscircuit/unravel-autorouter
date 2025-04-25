import React, { useState, useEffect } from "react"

interface SolveBreakpointDialogProps {
  isOpen: boolean
  onClose: () => void
  onSolve: (solverName: string, nodeId: string) => void
  initialNodeId: string
}

const availableSolvers = ["UnravelSectionSolver"] // Add more as needed

export const SolveBreakpointDialog: React.FC<SolveBreakpointDialogProps> = ({
  isOpen,
  onClose,
  onSolve,
  initialNodeId,
}) => {
  const [selectedSolver, setSelectedSolver] = useState(availableSolvers[0])
  const [nodeId, setNodeId] = useState(initialNodeId)

  useEffect(() => {
    setNodeId(initialNodeId) // Update if initialNodeId changes externally
  }, [initialNodeId])

  const handleSolve = () => {
    onSolve(selectedSolver, nodeId)
    onClose() // Close the dialog after initiating the solve
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Set Solve Breakpoint</h2>
        <div className="mb-4">
          <label
            htmlFor="solverName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Solver Name
          </label>
          <select
            id="solverName"
            value={selectedSolver}
            onChange={(e) => setSelectedSolver(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            {availableSolvers.map((solver) => (
              <option key={solver} value={solver}>
                {solver}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-6">
          <label
            htmlFor="nodeId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Capacity Mesh Node ID
          </label>
          <input
            type="text"
            id="nodeId"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            placeholder="e.g., cn123"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSolve}
            disabled={!nodeId} // Basic validation: ensure nodeId is not empty
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Solve to Breakpoint
          </button>
        </div>
      </div>
    </div>
  )
}
