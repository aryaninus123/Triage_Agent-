import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import MetricsDashboard from "./pages/MetricsDashboard";
import SubmitTicket from "./pages/SubmitTicket";
import TicketDetail from "./pages/TicketDetail";
import TicketQueue from "./pages/TicketQueue";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1"
    : "text-gray-500 hover:text-gray-800 pb-1";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-8">
          <span className="font-bold text-gray-900 text-lg">Support Triage Agent</span>
          <nav className="flex gap-6 text-sm">
            <NavLink to="/" end className={navClass}>
              Submit Ticket
            </NavLink>
            <NavLink to="/tickets" className={navClass}>
              Ticket Queue
            </NavLink>
            <NavLink to="/metrics" className={navClass}>
              Metrics
            </NavLink>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<SubmitTicket />} />
            <Route path="/tickets" element={<TicketQueue />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/metrics" element={<MetricsDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
