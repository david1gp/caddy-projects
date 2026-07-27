export function projectStorePath(user: string, name: string): string {
  return `projects/${user}/${name}.json`
}
