import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventIdDisplayMode, BackgroundType } from "@/components/QuoteCanvas";

interface StyleControlsProps {
  font: string;
  onFontChange: (value: string) => void;
  background: string;
  onBackgroundChange: (value: string) => void;
  backgroundType: BackgroundType;
  onBackgroundTypeChange: (value: BackgroundType) => void;
  eventIdDisplayMode: EventIdDisplayMode;
  onEventIdDisplayModeChange: (value: EventIdDisplayMode) => void;
}

export const StyleControls = ({
  font,
  onFontChange,
  background,
  onBackgroundChange,
  backgroundType,
  onBackgroundTypeChange,
  eventIdDisplayMode,
  onEventIdDisplayModeChange,
}: StyleControlsProps) => {
  return (
    <Card className="p-6 glass-card animate-slideUp">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="font">Font Style</Label>
          <Select value={font} onValueChange={onFontChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select font" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Inter">Inter</SelectItem>
              <SelectItem value="Playfair Display">Playfair Display</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="backgroundType">Background Type</Label>
          <Select
            value={backgroundType}
            onValueChange={(value) => onBackgroundTypeChange(value as BackgroundType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select background type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profile">Author Profile Picture</SelectItem>
              <SelectItem value="generated">Generated Picture</SelectItem>
              <SelectItem value="color">Solid Color</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {backgroundType === "color" && (
          <div className="space-y-2">
            <Label htmlFor="background">Background Color</Label>
            <Select value={background} onValueChange={onBackgroundChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select background color" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="#FFFFFF">White</SelectItem>
                <SelectItem value="#F8FAFC">Light Gray</SelectItem>
                <SelectItem value="#EDE9FE">Soft Purple</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="eventIdDisplay">Event ID Display</Label>
          <Select
            value={eventIdDisplayMode}
            onValueChange={(value) => onEventIdDisplayModeChange(value as EventIdDisplayMode)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select display mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">As Text</SelectItem>
              <SelectItem value="qrcode">As QR Code</SelectItem>
              <SelectItem value="hidden">Hide</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
};
