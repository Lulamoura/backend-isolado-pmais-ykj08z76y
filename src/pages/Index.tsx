/* Home Page - Replace this page layout, components, content, behavior with what you want and translate to the language of the user */
const Index = () => {
  return (
    <div className="relative min-h-[calc(100vh-2rem)] container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">
        This is a example page ready to be rewritten with your own content
      </h1>

      {/* Pipeline Status Indicator */}
      <div
        className="fixed bottom-3 right-3 text-[11px] font-mono text-muted-foreground/70 select-none pointer-events-none tracking-wider"
        aria-hidden="true"
      >
        PIPELINE SKIP OK
      </div>
    </div>
  )
}

export default Index
