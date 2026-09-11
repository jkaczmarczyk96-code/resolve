import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-5 py-14 sm:px-0"><Card className="shadow-none"><CardContent className="pt-2">{children}</CardContent></Card></div>;
}
