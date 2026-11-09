import { EditScreen } from "@/components/new-task/edit-screen";

export default async function EditPage({ params, searchParams }: PageProps<"/edit/[id]">) {
  const { id } = await params;
  const { type } = await searchParams;
  return <EditScreen id={id} makeEvent={type === "event"} />;
}
