// @ts-ignore
export const TableRow = ({ name, status, onReset }) => (
  <tr className="bg-white">
    <td className="border border-gray-200 px-3 py-1">{name}</td>
    <td className="border border-gray-200 px-3 py-1">{status ? "✅" : "❌"}</td>
    <td className="border border-gray-200 px-3 py-1">
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
        onClick={onReset}
      >
        Reset
      </button>
    </td>
  </tr>
);
