import {
  Principal,
  text,
  $query,
  $update,
  StableBTreeMap,
  Result,
  match,
  Vec,
  ic,
} from "azle";
import { Campaign, Donor } from "./types";

const generateId = () => {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 7; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return id;
};

const campaignStorage = new StableBTreeMap<string, Campaign>(0, 44, 1024);

$update;
export function createCampaign(
  _proposer: Principal,
  _title: text,
  _description: text,
  _goal: number,
  _deadline: number
): Result<Campaign, string> {
  try {
    if (!_proposer) {
      return Result.Err<Campaign, string>("Proposer is required");
    }
    if (!_title || _title.trim().length === 0) {
      return Result.Err<Campaign, string>("Title is required");
    }
    if (!_description || _description.trim().length === 0) {
      return Result.Err<Campaign, string>("Description is required");
    }
    if (_goal <= 0) {
      return Result.Err<Campaign, string>("Goal should be greater than 0");
    }

    const presentTime = Number(ic.time());
    const deadlineInNanoseconds = Number(_deadline * 86400 * 1_000_000_000);
    const endDate = presentTime + deadlineInNanoseconds;

    const campaign: Campaign = {
      id: generateId(),
      proposer: _proposer,
      title: _title,
      description: _description,
      goal: _goal,
      totalDonations: 0,
      deadline: endDate,
      donors: [] as Vec<Donor>,
    };

    campaignStorage.insert(campaign.id, campaign);
    return Result.Ok(campaign);
  } catch (err) {
    if (err instanceof Error) {
      return Result.Err<Campaign, string>(
        `Failed to create campaign: ${err.message}`
      );
    } else {
      return Result.Err<Campaign, string>(
        "Failed to create campaign: Unexpected error, Please try again later"
      );
    }
  }
}

$update;
export function updateOnlyTitleAndDescription(
  _campaignId: string,
  _title: string,
  _description: string
): Result<Campaign, string> {
  return match(campaignStorage.get(_campaignId), {
    Some: (campaign) => {
      campaign.title = _title;
      campaign.description = _description;
      campaignStorage.insert(_campaignId, campaign);
      return Result.Ok<Campaign, string>(campaign);
    },
    None: () =>
      Result.Err<Campaign, string>(
        `The campaign with id=${_campaignId} is not found`
      ),
  });
}

$update;
export function donateCampaign(
  _campaignId: string,
  _donorId: Principal,
  _amount: number
): Result<Campaign, string> {
  return match(campaignStorage.get(_campaignId), {
    Some: (campaign) => {
      if (_donorId === campaign.proposer) {
        return Result.Err<Campaign, string>("Donors cannot donate to their own campaigns");
      }
      if (Number(ic.time()) > Number(campaign.deadline)) {
        return Result.Err<Campaign, string>("This campaign has ended");
      }
      const newDonor: Donor = { id: _donorId, amount: _amount };
      campaign.donors.push(newDonor);
      if (campaign.goal >= campaign.totalDonations + _amount) {
        campaign.totalDonations += _amount;
      } else {
        return Result.Err<Campaign, string>(
          `Donation amount is greater than the goal`
        );
      }
      campaignStorage.insert(_campaignId, campaign);
      return Result.Ok<Campaign, string>(campaign);
    },
    None: () =>
      Result.Err<Campaign, string>(
        `The campaign with id=${_campaignId} is not found`
      ),
  });
}

$query;
export function getCampaign(id: string): Result<Campaign, string> {
  return match(campaignStorage.get(id), {
    Some: (campaign) => Result.Ok<Campaign, string>(campaign),
    None: () =>
      Result.Err<Campaign, string>(
        `The campaign with id=${id} is not found`
      ),
  });
}

$query;
export function getDeadlineByCampaignId(id: string): Result<number, string> {
  return match(campaignStorage.get(id), {
    Some: (campaign) => Result.Ok<number, string>(campaign.deadline),
    None: () =>
      Result.Err<number, string>(
        `The campaign with id=${id} does not exist`
      ),
  });
}

$update;
export function deleteCampaign(id: string): Result<Campaign, string> {
  return match(campaignStorage.remove(id), {
    Some: (deletedCampaign) => Result.Ok<Campaign, string>(deletedCampaign),
    None: () =>
      Result.Err<Campaign, string>(
        `The campaign with id=${id} is not found`
      ),
  });
}
