import { createFileRoute } from "@tanstack/react-router";
import { BackingDown } from "@/components/BackingDown";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BackingDown />;
}
