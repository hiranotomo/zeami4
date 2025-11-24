import { useState } from "react";
import Terminal from "./components/Terminal";

function App() {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">zeami4</h1>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded text-sm ${
              isConnected
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-700 text-gray-400'
            }`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <Terminal onConnectionChange={setIsConnected} />
      </main>
    </div>
  );
}

export default App;
