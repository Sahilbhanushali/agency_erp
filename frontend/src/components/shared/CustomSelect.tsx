import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomSelectProps {
  placeholder?: string;
  options: string[];
  value?: string
}

function CustomSelect({ placeholder = "Select", options } : CustomSelectProps) {
  return (
    <Select>
      <SelectTrigger className="min-w-[88px] focus-visible:shadow-none focus-visible:ring-0 font-medium text-neutral-900 dark:text-white data-[placeholder]:text-neutral-900">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {
          options.map((option) => {
            return (
              <SelectItem key={option} value={option}>
                {option}
            </SelectItem>
            )
          })
        }
      </SelectContent>
    </Select>
  );
}
export default CustomSelect;
