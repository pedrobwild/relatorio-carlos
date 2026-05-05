import { createContext, useContext } from "react";

interface ProjectLayoutContextType {
  /** True when the staff sidebar shell is active */
  hasShell: boolean;
}

const ProjectLayoutContext = createContext<ProjectLayoutContextType>({
  hasShell: false,
});

export const ProjectLayoutProvider = ProjectLayoutContext.Provider;

// eslint-disable-next-line react-refresh/only-export-components
export function useProjectLayout() {
  return useContext(ProjectLayoutContext);
}
