import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-brand-light group-[.toaster]:text-brand-dark group-[.toaster]:border-gray-200 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-brand-dark/70",
          actionButton:
            "group-[.toast]:bg-brand-secondary group-[.toast]:text-brand-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-brand-dark/70",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
