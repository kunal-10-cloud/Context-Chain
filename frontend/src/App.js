import "@/App.css";
import { Toaster } from "sonner";
import Workspace from "@/pages/Workspace";

function App() {
  return (
    <div className="App h-screen overflow-hidden">
      <Workspace />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "border border-zinc-200 rounded-sm shadow-none font-sans",
        }}
      />
    </div>
  );
}

export default App;
