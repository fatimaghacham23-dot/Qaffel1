import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export default function RuixenTableBasic() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-soft">
      <Table className="border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
          <TableRow className="hover:bg-transparent">
            <TableHead>Column</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="hover:bg-transparent">
            <TableCell className="text-sm text-slate-500" colSpan={2}>
              Use this shell as a local table style reference with real application data.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
