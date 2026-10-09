import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, ArrowRight } from "lucide-react"

export default function ShareRootPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg border-slate-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">
            Customer Share &amp; Approval Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-2">
          <p className="text-sm text-slate-600 leading-relaxed">
            Welcome to the social media content approval portal. To review and approve your planned posts, please use the specific link shared by your account manager.
          </p>
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-md text-xs text-blue-800 text-left">
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> Direct Access Required
            </div>
            Each content batch has a private, secure share token. If you cannot find your link, please contact your social media manager.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
