import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronDown, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandGroup,
  CommandList,
  CommandEmpty,
} from "@/components/ui/command";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosInstance } from "axios";

import type { ProblemResponse } from "@/pages/problems/ProblemDashboard";
import { Badge } from "./ui/badge";
import { toast } from "@/hooks/use-toast";
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const difficultyLevels = ["Easy", "Medium", "Hard"] as const;
const initialTagOptions = [
  "Array",
  "HashMap",
  "Sliding Window",
  "Heap",
  "Linked List",
];

const newProblemSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .nonempty("Name is required"),
  difficulty: z.enum(difficultyLevels, {
    errorMap: () => ({ message: "Select a difficulty level" }),
  }),
  tags: z.array(z.string()).min(1, "At least one tag is required"),
  date_solved: z.date({
    required_error: "Please indicate the solve date",
  }),
  notes: z.string().nonempty("Add a note"),
});

export type NewProblemFormData = z.infer<typeof newProblemSchema>;

interface NewProblemResponse {
  message: string;
  problem: ProblemResponse;
}

const createNewProblem = async (
  formData: NewProblemFormData,
  apiClient: AxiosInstance
): Promise<NewProblemResponse> => {
  const payload = {
    ...formData,
    date_solved: formData.date_solved
      ? format(formData.date_solved, "yyyy-MM-dd")
      : undefined,
  };
  const { data } = await apiClient.post("/problems", payload);
  return data;
};

interface NewProblemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewProblemDialog: React.FC<NewProblemDialogProps> = ({ isOpen, onOpenChange }) => {
  const apiClient = useAxios();
  const queryClient = useQueryClient();

  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [tagOptions, setTagOptions] = useState(initialTagOptions);
  const [inputValue, setInputValue] = useState("");
  const [isTagOpen, setIsTagOpen] = useState(false);

  const handleDropdownOpen = (opened: boolean) => {
    if (opened && dropdownTriggerRef.current) {
      setDropdownWidth(dropdownTriggerRef.current.offsetWidth);
    }
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<NewProblemFormData>({
    resolver: zodResolver(newProblemSchema),
    defaultValues: {
      name: "",
      difficulty: undefined,
      tags: [],
      date_solved: undefined,
      notes: "",
    },
    mode: "onChange",
  });

  const mutation = useMutation<
    NewProblemResponse,
    AxiosError<APIErrorResponse>,
    NewProblemFormData
  >({
    mutationFn: (formData) => createNewProblem(formData, apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      onOpenChange(false);
      reset();
      setInputValue("");
    },
    onError: (error) => {
      onOpenChange(false);
      reset();
      setInputValue("");
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to add new problem";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (formData: NewProblemFormData) => {
    mutation.mutate(formData);
  };

  const handleAddNewTag = (onChange: (tags: string[]) => void, currentTags: string[]) => {
    if (inputValue && !tagOptions.includes(inputValue)) {
      setTagOptions([...tagOptions, inputValue]);
      onChange([...currentTags, inputValue]);
    }
    setInputValue("");
    setIsTagOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left mb-4">
          <DialogTitle className="text-2xl font-bold">New Problem</DialogTitle>
          <DialogDescription>Enter problem details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name Field */}
          <div>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input
                  placeholder="Problem Title"
                  className="h-10"
                  {...field}
                />
              )}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Difficulty Dropdown */}
          <div>
            <Controller
              name="difficulty"
              control={control}
              render={({ field: { value, onChange } }) => (
                <DropdownMenu onOpenChange={handleDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-10"
                      ref={dropdownTriggerRef}
                    >
                      {value || "Select Difficulty"}{" "}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    style={{
                      width: dropdownWidth ? `${dropdownWidth}px` : "auto",
                    }}
                  >
                    {difficultyLevels.map((level) => (
                      <DropdownMenuItem
                        key={level}
                        onClick={() => onChange(level)}
                      >
                        {level}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            />
            {errors.difficulty && (
              <p className="text-red-500 text-sm">{errors.difficulty.message}</p>
            )}
          </div>

          {/* Tags Field with Custom Entry */}
          <div>
            <Controller
              name="tags"
              control={control}
              render={({ field: { value, onChange } }) => (
                <>
                  <Popover
                    open={isTagOpen}
                    onOpenChange={(open) => {
                      setIsTagOpen(open);
                      handleDropdownOpen(open);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-10">
                        {value?.length > 0
                          ? value.join(", ")
                          : "Select or Add Tags"}{" "}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="center"
                      className="w-full"
                      style={{
                        width: dropdownWidth ? `${dropdownWidth}px` : "auto",
                      }}
                    >
                      <Command>
                        <CommandInput
                          placeholder="Search or add a tag..."
                          value={inputValue}
                          onValueChange={(v) => setInputValue(v)}
                        />
                        <CommandList>
                          <CommandEmpty>No matching tags</CommandEmpty>
                          <CommandGroup>
                            {tagOptions.map((tag) => (
                              <CommandItem
                                key={tag}
                                onSelect={() => {
                                  // Add/remove tag in form
                                  if (value.includes(tag)) {
                                    onChange(value.filter((t) => t !== tag));
                                  } else {
                                    onChange([...value, tag]);
                                  }
                                }}
                              >
                                {value.includes(tag) ? "✔ " : ""}
                                {tag}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                      {/* Button to add a new typed tag */}
                      {inputValue && !tagOptions.includes(inputValue) && (
                        <Button
                          variant="outline"
                          className="w-full mt-2"
                          onClick={() => handleAddNewTag(onChange, value)}
                        >
                          Add "{inputValue}"
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>

                  {/* Display selected tags */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {value?.map((tag) => (
                      <Badge key={tag} className="flex items-center space-x-2">
                        {tag}
                        <button
                          type="button"
                          onClick={() =>
                            onChange(value.filter((t) => t !== tag))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            />
            {errors.tags && (
              <p className="text-red-500 text-sm">{errors.tags.message}</p>
            )}
          </div>

          {/* Date Solved Field */}
          <div>
            <Controller
              name="date_solved"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-10">
                      {value ? format(value, "PPP") : "Date Solved"}{" "}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="center">
                    <Calendar
                      mode="single"
                      selected={value}
                      onSelect={(date) => onChange(date ?? undefined)}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.date_solved && (
              <p className="text-red-500 text-sm">{errors.date_solved.message}</p>
            )}
          </div>

          {/* Notes Field */}
          <div>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <Textarea
                  placeholder="Additional Notes..."
                  style={{ height: "100px" }}
                  {...field}
                />
              )}
            />
            {errors.notes && (
              <p className="text-red-500 text-sm">{errors.notes.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              "Add Problem"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NewProblemDialog;