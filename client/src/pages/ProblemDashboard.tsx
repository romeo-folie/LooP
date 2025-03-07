import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  ChevronDown,
  MoreVertical,
  Plus,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import NewProblemDialog from "@/components/new-problem-dialog";
import { AxiosInstance } from "axios";
import { useAxios } from "@/hooks/use-axios";
import { useQuery } from "@tanstack/react-query";
import LoadingScreen from "@/components/loading-screen";

interface ProblemResponse {
  problem_id: number;
  user_id: number;
  name: string;
  difficulty: string;
  tags: string[];
  date_solved: Date;
  notes: string | null;
}

export interface Problem {
  name: string;
  difficulty: string;
  tags: string[];
  date_solved: Date | undefined;
  notes: string;
}

const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500",
  Medium: "bg-yellow-500",
  Hard: "bg-red-500",
};

const fetchProblems = async (apiClient: AxiosInstance) => {
  if (!apiClient) throw new Error("Axios instance not initialized");
  const { data } = await apiClient.get("/problems");
  return data;
};

export default function ProblemsDashboard() {
  const apiClient = useAxios();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(
    null
  );
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    undefined
  );

  const [currentPage, setCurrentPage] = useState(1);
  const problemsPerPage = 10;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["problems"],
    queryFn: () => fetchProblems(apiClient),
    enabled: !!apiClient,
  });

  if (isError) {
    console.log("Error fetching problems:", error);
  }

  const problems: ProblemResponse[] = data?.problems ?? [];

  // Sync filters with URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("search") || "");
    setSelectedDifficulty(params.get("difficulty") || null);
    setSelectedTag(params.get("tag") || null);
    setSelectedDate(
      params.get("date_solved") ? parseISO(params.get("date_solved")!) : undefined
    );
    setCurrentPage(Number(params.get("page")) || 1);
  }, [location.search]);

  // Update URL when filters change
  const updateQueryParams = () => {
    const params = new URLSearchParams();
    if (currentPage) params.set("page", currentPage.toString());
    if (search) params.set("search", search);
    if (selectedDifficulty) params.set("difficulty", selectedDifficulty);
    if (selectedTag) params.set("tag", selectedTag);
    if (selectedDate)
      params.set("date_solved", format(selectedDate, "yyyy-MM-dd"));

    navigate({ search: params.toString() }, { replace: true });
  };

  useEffect(updateQueryParams, [
    search,
    selectedDifficulty,
    selectedTag,
    selectedDate,
    currentPage,
    navigate,
  ]);

  // Reset Filters
  const resetFilters = () => {
    setSearch("");
    setSelectedDifficulty(null);
    setSelectedTag(null);
    setSelectedDate(undefined);
    setCurrentPage(1);
    navigate("/problems");
  };

  const filteredProblems = problems.filter((problem) => {
    return (
      problem.name.toLowerCase().includes(search.toLowerCase()) &&
      (!selectedDifficulty || problem.difficulty === selectedDifficulty) &&
      (!selectedTag || problem.tags.includes(selectedTag)) &&
      (!selectedDate || new Date(problem.date_solved).toISOString().split('T')[0] === format(selectedDate, "yyyy-MM-dd"))
    );
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredProblems.length / problemsPerPage);
  const paginatedProblems = filteredProblems.slice(
    (currentPage - 1) * problemsPerPage,
    currentPage * problemsPerPage
  );

  const handleNewProblemSubmit = (problem: Problem) => {
    console.log("New Problem Submitted:", problem);
  };

  return (
    <>
      {isLoading ? (
        <LoadingScreen />
      ) : (
        <div className="p-6 space-y-6">
          {/* Header Section (Title & New Button) */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Problems</h1>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>

          {/* Search & Filters Section */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              placeholder="Search problems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-1/3"
            />

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Difficulty Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {selectedDifficulty ?? "Difficulty"}{" "}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {["Easy", "Medium", "Hard"].map((level) => (
                    <DropdownMenuItem
                      key={level}
                      onClick={() => setSelectedDifficulty(level)}
                    >
                      {level}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tags Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {selectedTag ?? "Tags"}{" "}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {[
                    "Array",
                    "HashMap",
                    "Sliding Window",
                    "Heap",
                    "Linked List",
                  ].map((tag) => (
                    <DropdownMenuItem
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                    >
                      {tag}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date Solved Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    {selectedDate ? format(selectedDate, "PPP") : "Date Solved"}{" "}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                  />
                </PopoverContent>
              </Popover>
              {/* Reset Filters Button */}
              <Button
                variant="outline"
                className="flex items-center"
                onClick={resetFilters}
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>
          </div>

          {/* New Problem Dialog */}
          <NewProblemDialog
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onSubmit={handleNewProblemSubmit}
          />

          {/* Problems List */}
          {paginatedProblems.length ? (
            <>
              <div className="border rounded-md">
                {paginatedProblems.map((problem) => (
                  <div
                    key={problem.problem_id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-none hover:bg-muted transition"
                  >
                    {/* Clickable Problem Title */}
                    <span
                      className="cursor-pointer text-sm font-medium hover:underline"
                      onClick={() => navigate(`/problems/${problem.problem_id}`)}
                    >
                      {problem.name}
                    </span>

                    <div className="flex items-center gap-4">
                      {/* Difficulty Badge */}
                      <Badge
                        className={`${
                          difficultyColors[problem.difficulty]
                        } text-white`}
                      >
                        {problem.difficulty}
                      </Badge>

                      {/* More Options Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              console.log("Add reminder for", problem.problem_id)
                            }
                          >
                            Add Reminder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => console.log("Delete", problem.problem_id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center sm:justify-end items-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                  >
                    <ArrowLeft className="h-4 w-4" /> Prev
                  </Button>
                  <span className="text-sm font-medium">
                    {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="border rounded-md p-4 text-center text-gray-500">
              No problems found
            </div>
          )}
        </div>
      )}
    </>
  );
}
