import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/lib/supabase/projects";
import { ProjectsView } from "@/components/projects/projects-view";

export default async function ProjectsPage() {
  const supabase = createClient();
  const projects = await getProjects(supabase);

  return <ProjectsView initialProjects={projects} />;
}
