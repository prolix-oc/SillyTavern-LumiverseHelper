import React from 'react';
import { MacroItem } from '../shared/settingsHelpers';

export default function MacroReferenceView() {
    return (
        <div className="lumiverse-settings-view">
            <div className="lumia-macro-reference">
                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Lumia Content</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{lumiaDef}}" description="Physical Definition" />
                        <MacroItem code="{{lumiaBehavior}}" description="Behavior(s)" />
                        <MacroItem code="{{lumiaPersonality}}" description="Personality(s)" />
                        <MacroItem code="{{lumiaCouncilModeActive}}" description="Yes/No status indicator, (conditional ready)" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Loom Content</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomStyle}}" description="Narrative Style" />
                        <MacroItem code="{{loomUtils}}" description="Loom Utilities" />
                        <MacroItem code="{{loomRetrofits}}" description="Retrofits" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Random Lumia</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{randomLumia}}" description="Random definition" />
                        <MacroItem code="{{randomLumia.pers}}" description="Random personality" />
                        <MacroItem code="{{randomLumia.behav}}" description="Random behavior" />
                        <MacroItem code="{{randomLumia.name}}" description="Random name" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Tracking & OOC</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{lumiaMessageCount}}" description="Message count" />
                        <MacroItem code="{{lumiaOOCTrigger}}" description="OOC trigger/countdown" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Summarization</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomSummary}}" description="Stored summary" />
                        <MacroItem code="{{loomSummaryPrompt}}" description="Summary directive" />
                        <MacroItem code="/loom-summarize" description="Manual trigger" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Message History</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomLastUserMessage}}" description="Last user message content" />
                        <MacroItem code="{{loomLastCharMessage}}" description="Last character message content" />
                        <MacroItem code="{{lastMessageName}}" description="Name of whoever sent the last message" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Sovereign Hand</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomSovHand}}" description="Full Sovereign Hand prompt (with user message)" />
                        <MacroItem code="{{loomSovHandActive}}" description="Yes/No status indicator (conditional ready)" />
                        <MacroItem code="{{loomContinuePrompt}}" description="Continue-scene prompt when character spoke last" />
                    </div>
                </div>
            </div>
        </div>
    );
}
