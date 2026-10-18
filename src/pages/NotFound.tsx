import { Link } from "react-router-dom";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="max-w-sm space-y-4 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <SearchX className="h-5 w-5" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pagina niet gevonden</h1>
        <p className="text-sm text-muted-foreground">
          De pagina die je zoekt bestaat niet (meer) of is verplaatst.
        </p>
      </div>
      <Button asChild>
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Naar dashboard
        </Link>
      </Button>
    </div>
  </div>
);

export default NotFound;
