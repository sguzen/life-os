import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/supabase/projects";
import { ProjectDetail } from "@/components/projects/project-detail";

interface Props {
  params: { id: string };
}

export default async function ProjectPage({ params }: Props) {
  const supabase = createClient();
  const project = await getProject(supabase, params.id);

  if (!project) notFound();

  return <ProjectDetail project={project} />;
}
