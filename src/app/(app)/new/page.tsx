import { NewTaskScreen } from "@/components/new-task/new-task-screen";

export default async function NewTaskPage({ searchParams }: PageProps<"/new">) {
  const { voice } = await searchParams;
  return <NewTaskScreen startVoice={voice === "1"} />;
}
