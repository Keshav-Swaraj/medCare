import React from 'react';
import { Check, Clock, Calendar, Mail, MessageSquare, CalendarDays } from 'lucide-react';

function FloatingElements() {
  return (
    <div className="absolute inset-0 pointer-events-none hidden lg:block overflow-hidden z-0">
      
      {/* Top Left - Yellow Sticky Note */}
      <div className="absolute top-[10%] left-[8%] transform -rotate-6 w-56">
        {/* Shadow backdrop */}
        <div className="absolute inset-0 bg-black/5 blur-sm translate-y-2 rounded"></div>
        {/* Sticky note */}
        <div className="relative bg-[#fef08a] p-4 pt-6 shadow-sm rounded-sm">
          {/* Red Pin */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-sm"></div>
          <p className="font-['Caveat',cursive] text-gray-800 text-lg leading-tight -rotate-2">
            Take notes to keep track of crucial details, and accomplish more tasks with ease.
          </p>
        </div>
      </div>

      {/* Mid Left - Checkbox Button */}
      <div className="absolute top-[40%] left-[12%] transform rotate-12">
        <div className="bg-white p-4 rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-gray-100 flex items-center justify-center relative">
          {/* subtle inset shadow effect mock */}
          <div className="w-12 h-12 bg-brandBlue rounded-xl flex items-center justify-center shadow-inner">
            <Check className="text-white w-6 h-6 stroke-[3]" />
          </div>
        </div>
      </div>

      {/* Top Right - Reminders Card */}
      <div className="absolute top-[15%] right-[10%] transform rotate-6 w-64 bg-white/90 backdrop-blur-sm p-4 rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.08)] border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900 text-sm">Reminders</h3>
          <span className="text-xs text-gray-400">Meetings</span>
        </div>
        <div className="bg-gray-50/80 rounded-2xl p-3 border border-gray-100/50">
          <p className="text-sm font-medium text-gray-800 mb-1">Today's Meeting</p>
          <p className="text-xs text-gray-400 mb-3">Call with marketing team</p>
          <div className="flex items-center justify-center gap-1.5 bg-white border border-cyan-100 text-cyan-600 rounded-lg py-1.5 px-2 w-max mx-auto shadow-sm">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">13:00 - 13:45</span>
          </div>
        </div>
        {/* Floating Clock Icon beside it */}
        <div className="absolute -left-12 top-10 bg-white p-3 rounded-2xl shadow-xl border border-gray-100">
          <div className="relative w-10 h-10 rounded-full border-[3px] border-gray-800 flex items-center justify-center">
            <div className="w-1 h-3 bg-gray-800 absolute top-1.5 left-[16px] origin-bottom rounded-full"></div>
            <div className="w-2 h-1 bg-red-500 absolute top-[18px] left-[18px] origin-left rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Bottom Left - Today's tasks */}
      <div className="absolute bottom-[5%] left-[8%] transform -rotate-3 w-72 bg-white/95 backdrop-blur p-5 rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.08)] border border-gray-100">
        <h3 className="font-semibold text-gray-900 text-base mb-4">Today's tasks</h3>
        
        <div className="space-y-4">
          {/* Task 1 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold">8</div>
              <p className="text-sm font-medium text-gray-800 flex-1">New Ideas for campaign</p>
              <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white -ml-2 z-10"></div>
              <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white -ml-3"></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium">Sep 10</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 w-[60%] rounded-full"></div>
              </div>
              <span className="text-xs text-gray-500 font-medium">60%</span>
            </div>
          </div>

          <div className="h-px bg-gray-100 w-full"></div>

          {/* Task 2 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">3</div>
              <p className="text-sm font-medium text-gray-800 flex-1">Design PPT #4</p>
              <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white -ml-2 z-10"></div>
              <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white -ml-3"></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium">Sep 18</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 w-[112%] rounded-full"></div>
              </div>
              <span className="text-xs text-gray-500 font-medium">112%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Right - Integrations Card */}
      <div className="absolute bottom-[8%] right-[12%] transform rotate-2 w-72 bg-white/95 backdrop-blur p-5 rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.08)] border border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">100+ Integrations</h3>
        
        <div className="flex gap-2 relative h-16">
          {/* Gmail-ish Icon */}
          <div className="absolute left-0 z-10 bg-white p-3 rounded-2xl shadow-lg border border-gray-100 transform -rotate-6">
            <Mail className="w-8 h-8 text-red-500" />
          </div>
          {/* Slack-ish Icon */}
          <div className="absolute left-14 z-20 bg-white p-3 rounded-2xl shadow-lg border border-gray-100 transform -translate-y-2">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
          </div>
          {/* Calendar-ish Icon */}
          <div className="absolute left-28 z-30 bg-white p-3 rounded-2xl shadow-lg border border-gray-100 transform rotate-6">
             <CalendarDays className="w-8 h-8 text-brandBlue" />
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-1">
               <span className="text-brandBlue font-bold text-xs">31</span>
             </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default FloatingElements;
