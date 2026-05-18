import Link from "next/link";
import { PackageSearch, Upload, GitCompare, Settings2 } from "lucide-react";
import OrderSearchPanel from "@/components/OrderSearchPanel";

const cards = [
  {
    href: "/upload",
    icon: Upload,
    title: "Upload Order",
    desc: "Import a CSV or Excel file to load order items.",
    color: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-500",
  },
  {
    href: "/optimise",
    icon: PackageSearch,
    title: "Optimise",
    desc: "Configure pallet settings and run the optimisation engine.",
    color: "bg-green-50 border-green-200",
    iconColor: "text-green-600",
  },
  {
    href: "/compare",
    icon: GitCompare,
    title: "Compare Algorithms",
    desc: "Run all algorithms and see a side-by-side comparison.",
    color: "bg-purple-50 border-purple-200",
    iconColor: "text-purple-600",
  },
  {
    href: "/settings",
    icon: Settings2,
    title: "Settings",
    desc: "Manage pallet presets and algorithm defaults.",
    color: "bg-gray-50 border-gray-200",
    iconColor: "text-gray-500",
  },
];

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Palletisation Optimiser</h1>
        <p className="text-gray-500 mt-1">
          Plan, optimise, and visualise warehouse palletisation runs.
        </p>
      </div>

      <OrderSearchPanel />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {cards.map(({ href, icon: Icon, title, desc, color, iconColor }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-start gap-4 p-6 rounded-xl border ${color} hover:shadow-md transition-shadow`}
          >
            <div className={`mt-0.5 ${iconColor}`}>
              <Icon size={28} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-lg">{title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-700 mb-3">Quick Start</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
          <li>Go to <strong>Upload</strong> and import your order CSV/Excel.</li>
          <li>Head to <strong>Optimise</strong>, configure pallet specs, choose an algorithm, and run.</li>
          <li>View the 3D pallet visualisation and box placement details on the <strong>Results</strong> page.</li>
          <li>Use <strong>Compare</strong> to benchmark all algorithms side-by-side.</li>
          <li>Export results as CSV or JSON.</li>
        </ol>
      </div>
    </div>
  );
}
