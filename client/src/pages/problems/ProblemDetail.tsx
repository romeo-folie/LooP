import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import ReminderCard from "@/components/reminder-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Example color coding for difficulty
const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500 text-white",
  Medium: "bg-yellow-500 text-white",
  Hard: "bg-red-500 text-white",
};

const ProblemDetail: React.FC = () => {
  // Placeholder data for demonstration
  const [problem] = useState({
    title: "Two Sum",
    notes: "Use a hashmap to optimize lookup time.",
    difficulty: "Easy",
    tags: ["Array", "HashMap"],
    reminders: [
      { date: new Date(2025, 2, 17, 14, 30), is_sent: false },
      { date: new Date(2025, 2, 25, 9, 0), is_sent: true },
      { date: new Date(2025, 2, 25, 9, 0), is_sent: true },
      { date: new Date(2025, 2, 25, 9, 0), is_sent: true },
    ],
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header: Title & Edit Button */}
      <div className="flex justify-between items-start">
        {/* Title & Notes */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{problem.title}</h1>
          <p className="text-gray-700 mt-2">{problem.notes}</p>
        </div>

        {/* Edit + Difficulty & Tags */}
        <div className="flex flex-col items-end gap-4">
          {/* Edit Button */}
          <Button className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>

          {/* Difficulty & Tags */}
          <div className="text-right space-y-2">
            <div>
              <p className="text-sm text-gray-500">Difficulty</p>
              <Badge className={`${difficultyColors[problem.difficulty]}`}>
                {problem.difficulty}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tags</p>
              <div className="flex flex-wrap gap-2 justify-end">
                {problem.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reminders Section */}
      {problem.reminders && problem.reminders.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Reminders</h2>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 py-5">
              {problem.reminders.map((rem, index) => (
                <ReminderCard
                  key={index}
                  date={rem.date}
                  is_sent={rem.is_sent}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
export default ProblemDetail;
