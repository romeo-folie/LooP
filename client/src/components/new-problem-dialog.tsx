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
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";
import { AxiosError, AxiosInstance } from "axios";

import type { Problem, ProblemResponse } from "@/pages/ProblemDashboard";
import { Badge } from "./ui/badge";

const difficultyLevels = ["Easy", "Medium", "Hard"];
const initialTagOptions = [
  "Array",
  "HashMap",
  "Sliding Window",
  "Heap",
  "Linked List",
];

interface NewProblemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NewProblemResponse {
  message: string;
  problem: ProblemResponse;
}

const createNewProblem = async (problem: Problem, apiClient: AxiosInstance) => {
  const { data } = await apiClient.post("/problems", {
    ...problem,
    date_solved: problem.date_solved,
  });
  return data;
};

export default function NewProblemDialog({
  isOpen,
  onOpenChange,
}: NewProblemDialogProps) {
  const apiClient = useAxios();
  const queryClient = useQueryClient();

  const [tagOptions, setTagOptions] = useState(initialTagOptions);
  const [inputValue, setInputValue] = useState("");
  const [isTagOpen, setIsTagOpen] = useState(false);
  const [newProblem, setNewProblem] = useState<Problem>({
    name: "",
    difficulty: "",
    tags: [] as string[],
    date_solved: undefined as Date | undefined,
    notes: "",
  });

  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleDropdownOpen = (isOpen: boolean) => {
    if (isOpen && dropdownTriggerRef.current) {
      setDropdownWidth(dropdownTriggerRef.current.offsetWidth);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setNewProblem({ ...newProblem, [e.target.name]: e.target.value });
  };

  const handleDifficultySelect = (difficulty: string) => {
    setNewProblem({ ...newProblem, difficulty });
  };

  const handleTagSelect = (tag: string) => {
    setNewProblem((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleAddNewTag = () => {
    if (inputValue && !tagOptions.includes(inputValue)) {
      setTagOptions([...tagOptions, inputValue]);
      setNewProblem({ ...newProblem, tags: [...newProblem.tags, inputValue] });
    }
    setInputValue("");
    setIsTagOpen(false);
  };

  const handleTagRemove = (tag: string) => {
    setNewProblem((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const mutation = useMutation<
    NewProblemResponse,
    AxiosError<APIErrorResponse>,
    Problem
  >({
    mutationFn: (problem: Problem) => createNewProblem(problem, apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problems"] }); // Refresh problem list
      onOpenChange(false); // Close modal
      resetForm(); // Reset form fields
    },
  });

  const resetForm = () => {
    setNewProblem({
      name: "",
      difficulty: "",
      tags: [],
      date_solved: undefined,
      notes: "",
    });
  };

  const handleSubmit = () => {
    mutation.mutate(newProblem);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left mb-4">
          <DialogTitle>New Problem</DialogTitle>
          <DialogDescription>Enter problem details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name Field */}
          <Input
            placeholder="Problem Title"
            name="name"
            value={newProblem.name}
            className="h-10"
            onChange={handleInputChange}
          />

          {/* Difficulty Dropdown (Auto Width) */}
          <DropdownMenu onOpenChange={handleDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-10"
                ref={dropdownTriggerRef}
              >
                {newProblem.difficulty || "Select Difficulty"}{" "}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              style={{ width: dropdownWidth ? `${dropdownWidth}px` : "auto" }}
            >
              {difficultyLevels.map((level) => (
                <DropdownMenuItem
                  key={level}
                  onClick={() => handleDifficultySelect(level)}
                >
                  {level}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tags Multi-Select (With Custom Entry) */}
          <div className="space-y-2">
            <Popover
              open={isTagOpen}
              onOpenChange={() => {
                setIsTagOpen((prev) => !prev);
                handleDropdownOpen(true);
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full">
                  {newProblem.tags.length > 0
                    ? newProblem.tags.join(", ")
                    : "Select or Add Tags"}{" "}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                className="w-full"
                style={{ width: dropdownWidth ? `${dropdownWidth}px` : "auto" }}
              >
                <Command>
                  <CommandInput
                    placeholder="Search or add a tag..."
                    value={inputValue}
                    onValueChange={(value) => setInputValue(value)}
                  />
                  <CommandList>
                    <CommandEmpty>No matching tags</CommandEmpty>
                    <CommandGroup>
                      {tagOptions.map((tag) => (
                        <CommandItem
                          key={tag}
                          onSelect={() => handleTagSelect(tag)}
                        >
                          {newProblem.tags.includes(tag) ? "✔ " : ""}
                          {tag}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {/* Button to add a new tag */}
                {inputValue && !tagOptions.includes(inputValue) && (
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={handleAddNewTag}
                  >
                    Add "{inputValue}"
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            {/* Display selected tags as removable badges */}
            <div className="flex flex-wrap gap-2">
              {newProblem.tags.map((tag) => (
                <Badge key={tag} className="flex items-center space-x-2">
                  {tag}
                  <button onClick={() => handleTagRemove(tag)} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Date Solved Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-10">
                {newProblem.date_solved
                  ? format(newProblem.date_solved, "PPP")
                  : "Date Solved"}{" "}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Calendar
                mode="single"
                selected={newProblem.date_solved}
                onSelect={(date) =>
                  setNewProblem({ ...newProblem, date_solved: date })
                }
              />
            </PopoverContent>
          </Popover>

          {/* Notes Field */}
          <Textarea
            placeholder="Additional Notes..."
            name="notes"
            value={newProblem.notes}
            onChange={handleInputChange}
            style={{ height: "100px" }}
          />

          {/* Submit Button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              "Add Problem"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
