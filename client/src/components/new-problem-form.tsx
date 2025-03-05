import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";

const difficultyLevels = ["Easy", "Medium", "Hard"];
const tagOptions = ["Array", "HashMap", "Sliding Window", "Heap", "Linked List"];

interface NewProblemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (problem: { name: string; difficulty: string; tags: string[]; dateSolved: Date | null; notes: string }) => void;
}

export default function NewProblemDialog({ isOpen, onOpenChange, onSubmit }: NewProblemDialogProps) {
  const [newProblem, setNewProblem] = useState({
    name: "",
    difficulty: "",
    tags: [] as string[],
    dateSolved: null as Date | null,
    notes: ""
  });

  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleDropdownOpen = (isOpen: boolean) => {
    if (isOpen && dropdownTriggerRef.current) {
      setDropdownWidth(dropdownTriggerRef.current.offsetWidth);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewProblem({ ...newProblem, [e.target.name]: e.target.value });
  };

  const handleDifficultySelect = (difficulty: string) => {
    setNewProblem({ ...newProblem, difficulty });
  };

  const handleTagSelect = (tag: string) => {
    setNewProblem((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag]
    }));
  };

  const handleSubmit = () => {
    onSubmit(newProblem);
    setNewProblem({ name: "", difficulty: "", tags: [], dateSolved: null, notes: "" }); // Reset Form
    onOpenChange(false);
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
          <Input placeholder="Problem Title" name="name" value={newProblem.name} className="h-10" onChange={handleInputChange} />

          {/* Difficulty Dropdown (Auto Width) */}
          <DropdownMenu onOpenChange={handleDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full h-10" ref={dropdownTriggerRef}>
                {newProblem.difficulty || "Select Difficulty"} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" style={{ width: dropdownWidth ? `${dropdownWidth}px` : "auto" }}>
              {difficultyLevels.map((level) => (
                <DropdownMenuItem key={level} onClick={() => handleDifficultySelect(level)}>
                  {level}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tags Multi-Select Dropdown (Auto Width) */}
          <DropdownMenu onOpenChange={handleDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full h-10" ref={dropdownTriggerRef}>
                {newProblem.tags.length > 0 ? newProblem.tags.join(", ") : "Select Tags"} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" style={{ width: dropdownWidth ? `${dropdownWidth}px` : "auto" }}>
              {tagOptions.map((tag) => (
                <DropdownMenuItem key={tag} onClick={() => handleTagSelect(tag)}>
                  {newProblem.tags.includes(tag) ? "✔ " : ""}{tag}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Solved Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-10">
                {newProblem.dateSolved ? format(newProblem.dateSolved, "PPP") : "Date Solved"} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Calendar mode="single" selected={newProblem.dateSolved} onSelect={(date) => setNewProblem({ ...newProblem, dateSolved: date })} />
            </PopoverContent>
          </Popover>

          {/* Notes Field */}
          <Textarea placeholder="Additional Notes..." name="notes" value={newProblem.notes} onChange={handleInputChange} style={{ height: "100px" }}/>

          {/* Submit Button */}
          <Button className="w-full" onClick={handleSubmit}>Add Problem</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
