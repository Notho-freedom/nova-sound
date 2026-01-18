/**
 * Nexus FAB (Floating Action Button)
 *
 * Button to open the Nexus assistant

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NexusAssistant } from "@/components/NexusAssistant";
import { cn } from "@/lib/utils";

interface NexusFABProps {
  className?: string;
}

export function NexusFAB({ className }: NexusFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(true);

  return (
    <>
      {/* Floating Action Button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 260, damping: 20 }}
        className={cn(
          "fixed bottom-24 right-6 z-[9999]",
          className
        )}
      >
        <div className="relative">
          {/* Pulse animation */}
          {showPulse && (
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/30"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "loop",
              }}
            />
          )}
          
          {/* Main button */}
          <Button
            size="lg"
            onClick={() => {
              setIsOpen(true);
              setShowPulse(false);
            }}
            className={cn(
              "relative h-14 w-14 rounded-full shadow-2xl",
              "bg-gradient-to-br from-primary to-secondary",
              "hover:shadow-primary/50 hover:scale-110",
              "transition-all duration-300",
              "group"
            )}
          >
            <div className="relative">
              <Bot className="w-6 h-6 text-white" />
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "loop",
                }}
              >
                <Sparkles className="w-3 h-3 text-yellow-300" />
              </motion.div>
            </div>
          </Button>

          {/* Tooltip */}
          <AnimatePresence>
            {!isOpen && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute right-full top-1/2 -translate-y-1/2 mr-3 whitespace-nowrap"
              >
                <div className="px-3 py-2 bg-card rounded-lg shadow-lg border border-border/50 backdrop-blur-xl">
                  <p className="text-sm font-medium">Assistant Nexus</p>
                  <p className="text-xs text-muted-foreground">Posez-moi vos questions</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Dialog with assistant */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl h-[80vh] p-0 gap-0">
          <NexusAssistant onClose={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
