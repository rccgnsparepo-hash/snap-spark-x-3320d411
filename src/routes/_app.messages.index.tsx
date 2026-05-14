import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_app/messages/")({
  component: () => (
    <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-10">
      <MessageCircle className="w-12 h-12 text-snap" />
      <p>Pick someone to start a disappearing chat.</p>
    </div>
  ),
});
